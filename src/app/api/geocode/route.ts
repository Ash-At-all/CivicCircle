import { NextResponse } from "next/server";
import { geocodeQuerySchema } from "@/features/area/schema";
import { CITY_CONFIGS, findCityForCoords, type CityConfig } from "@/features/area/cities";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Broad Maharashtra box used as a soft search area. Results are still
// filtered against the supported city boxes below, so this only widens the
// candidate set for Photon.
const SEARCH_BBOX = {
  minLat: 15.6,
  maxLat: 22.2,
  minLng: 72.5,
  maxLng: 80.9,
} as const;

const SEARCH_BIAS = { lat: 19.75, lng: 75.5 } as const;
const RESULT_LIMIT = 5;

function cacheKey(q: string) {
  return `photon:cities:${q.toLowerCase().trim()}`;
}

type PhotonFeature = {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: [number, number] };
};

type GeocodeResult = {
  name: string;
  label: string;
  lat: number;
  lng: number;
  city: string;
  cityName: string;
};

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

function bboxParam(bounds: Bounds) {
  return `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}`;
}

async function fetchPhoton(q: string, bbox: Bounds) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "20");
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", String(SEARCH_BIAS.lat));
  url.searchParams.set("lon", String(SEARCH_BIAS.lng));
  url.searchParams.set("bbox", bboxParam(bbox));

  const response = await fetch(url, {
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Photon responded ${response.status}`);
  }
  const json = await response.json() as { features?: PhotonFeature[] };
  return json.features ?? [];
}

function mapFeatures(features: PhotonFeature[], seen: Set<string>): GeocodeResult[] {
  const results: GeocodeResult[] = [];
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    const lng = coords?.[0];
    const lat = coords?.[1];
    const name = String(feature.properties?.name ?? feature.properties?.street ?? "").trim();
    const placeCity = String(feature.properties?.city ?? feature.properties?.county ?? feature.properties?.state ?? "").trim();
    if (typeof lat !== "number" || typeof lng !== "number" || !name) continue;

    const city = findCityForCoords(lat, lng);
    if (!city) continue;

    const dedupeKey = `${name.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    results.push({
      name,
      label: [name, placeCity || city.name].filter(Boolean).join(", "),
      lat,
      lng,
      city: city.slug,
      cityName: city.name,
    });
  }
  return results;
}

function relevance(result: GeocodeResult, query: string) {
  const q = query.toLowerCase().trim();
  const name = result.name.toLowerCase();
  if (name === q) return 0;
  if (name.includes(q)) return 1;
  if (result.label.toLowerCase().includes(q)) return 2;
  return 3;
}

async function searchCity(query: string, city: CityConfig) {
  const features = await fetchPhoton(`${query}, ${city.name}`, city.bounds);
  return { city, features };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = geocodeQuerySchema.safeParse({ q: searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter at least 2 characters to search.", code: "invalid_request" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json({ error: "Sign in to search for an area.", code: "auth_required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "geocode");
    if (rateLimitResponse) return rateLimitResponse;

    const key = cacheKey(parsed.data.q);
    const admin = getSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    const cached = await admin
      .from("geocode_cache")
      .select("payload, expires_at")
      .eq("key", key)
      .maybeSingle();

    if (!cached.error && cached.data && cached.data.expires_at > nowIso) {
      return NextResponse.json(cached.data.payload);
    }

    const seen = new Set<string>();
    let results: GeocodeResult[];
    try {
      const plainFeatures = await fetchPhoton(parsed.data.q, SEARCH_BBOX);
      results = mapFeatures(plainFeatures, seen);
    } catch (error) {
      console.error("Geocode plain search failed:", error);
      return NextResponse.json({ error: "Could not search for that area right now.", code: "server_error" }, { status: 502 });
    }

    // A broad query misses some local names (for example a road that Photon
    // only indexes with its city). Fill the gaps with city-scoped searches.
    if (results.length < RESULT_LIMIT) {
      const represented = new Set(results.map((result) => result.city));
      const missing = CITY_CONFIGS.filter((city) => !represented.has(city.slug));
      const settled = await Promise.allSettled(missing.map((city) => searchCity(parsed.data.q, city)));
      for (const item of settled) {
        if (item.status === "fulfilled") {
          // City-scoped Photon queries often echo the city itself when the
          // place is not in that city. Keep only names that match the query.
          const extra = mapFeatures(item.value.features, seen)
            .filter((result) => relevance(result, parsed.data.q) <= 1);
          results.push(...extra);
        }
      }
    }

    results = results
      .sort((a, b) => relevance(a, parsed.data.q) - relevance(b, parsed.data.q))
      .slice(0, RESULT_LIMIT);

    const payload = { results };
    await admin.from("geocode_cache").upsert({
      key,
      payload,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "key" });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Geocode failed:", error);
    return NextResponse.json({ error: "Could not search for that area right now.", code: "server_error" }, { status: 503 });
  }
}
