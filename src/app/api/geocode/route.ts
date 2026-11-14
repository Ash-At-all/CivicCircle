import { NextResponse } from "next/server";
import { geocodeQuerySchema } from "@/features/area/schema";
import { CITY_BOUNDS, CITY_SLUG } from "@/features/area/h3";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function cacheKey(q: string) {
  return `photon:${CITY_SLUG}:${q.toLowerCase().trim()}`;
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

    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", `${parsed.data.q}, Chhatrapati Sambhajinagar`);
    url.searchParams.set("limit", "5");
    url.searchParams.set("lang", "en");
    url.searchParams.set("lat", "19.8762");
    url.searchParams.set("lon", "75.3433");
    url.searchParams.set("bbox", `${CITY_BOUNDS.minLng},${CITY_BOUNDS.minLat},${CITY_BOUNDS.maxLng},${CITY_BOUNDS.maxLat}`);

    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Could not search for that area right now.", code: "server_error" }, { status: 502 });
    }

    const json = await response.json() as { features?: Array<{ properties?: Record<string, unknown>; geometry?: { coordinates?: [number, number] } }> };
    const results = (json.features ?? [])
      .map((feature) => {
        const coords = feature.geometry?.coordinates;
        const lng = coords?.[0];
        const lat = coords?.[1];
        const name = String(feature.properties?.name ?? feature.properties?.street ?? "").trim();
        const city = String(feature.properties?.city ?? feature.properties?.county ?? feature.properties?.state ?? "").trim();
        if (typeof lat !== "number" || typeof lng !== "number" || !name) return null;
        return { name, label: [name, city].filter(Boolean).join(", "), lat, lng };
      })
      .filter((item): item is { name: string; label: string; lat: number; lng: number } => item !== null)
      .filter((item) => item.lat >= CITY_BOUNDS.minLat && item.lat <= CITY_BOUNDS.maxLat && item.lng >= CITY_BOUNDS.minLng && item.lng <= CITY_BOUNDS.maxLng)
      .slice(0, 5);

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
