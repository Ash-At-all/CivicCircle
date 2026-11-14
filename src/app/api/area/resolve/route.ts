import { NextResponse } from "next/server";
import { resolveAreaSchema } from "@/features/area/schema";
import { CITY_SLUG, cellCentroid, validateAreaCell } from "@/features/area/h3";
import { DEFAULT_CITY_NAME, DEFAULT_CITY_NAME_HI, fallbackAreaName } from "@/features/area/names";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 1024;

function badArea(message = "The selected area is not valid.") {
  return NextResponse.json({ error: message, code: "invalid_area" }, { status: 400 });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error, code: "invalid_request" }, { status: payload.status });

  const parsed = resolveAreaSchema.safeParse(payload.value);
  if (!parsed.success) return badArea();

  const { h3r8, h3r7, h3r5 } = parsed.data;
  if (!validateAreaCell("locality", h3r8) || !validateAreaCell("ward", h3r7) || !validateAreaCell("city", h3r5)) {
    return badArea();
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json({ error: "Sign in to set your area.", code: "auth_required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "areaResolve");
    if (rateLimitResponse) return rateLimitResponse;

    const cityCentroid = cellCentroid(h3r5);
    const wardCentroid = cellCentroid(h3r7);
    const localityCentroid = cellCentroid(h3r8);

    const admin = getSupabaseAdminClient();

    const city = await admin.rpc("ensure_area", {
      p_kind: "city",
      p_h3: h3r5,
      p_name: DEFAULT_CITY_NAME,
      p_name_hi: DEFAULT_CITY_NAME_HI,
      p_city: CITY_SLUG,
      p_lat: cityCentroid.lat,
      p_lng: cityCentroid.lng,
      p_parent_id: null,
    });
    if (city.error || !city.data) {
      console.error("Area resolve ensure_area(city) failed:", {
        code: city.error?.code,
        message: city.error?.message,
        details: city.error?.details,
        hint: city.error?.hint,
      });
      return NextResponse.json({ error: "Could not resolve your area.", code: "server_error" }, { status: 502 });
    }
    const cityRow = Array.isArray(city.data) ? city.data[0] : city.data;

    const ward = await admin.rpc("ensure_area", {
      p_kind: "ward",
      p_h3: h3r7,
      p_name: fallbackAreaName("ward"),
      p_name_hi: null,
      p_city: CITY_SLUG,
      p_lat: wardCentroid.lat,
      p_lng: wardCentroid.lng,
      p_parent_id: cityRow.id,
    });
    if (ward.error || !ward.data) {
      console.error("Area resolve ensure_area(ward) failed:", {
        code: ward.error?.code,
        message: ward.error?.message,
        details: ward.error?.details,
        hint: ward.error?.hint,
      });
      return NextResponse.json({ error: "Could not resolve your area.", code: "server_error" }, { status: 502 });
    }
    const wardRow = Array.isArray(ward.data) ? ward.data[0] : ward.data;

    const locality = await admin.rpc("ensure_area", {
      p_kind: "locality",
      p_h3: h3r8,
      p_name: fallbackAreaName("locality"),
      p_name_hi: null,
      p_city: CITY_SLUG,
      p_lat: localityCentroid.lat,
      p_lng: localityCentroid.lng,
      p_parent_id: wardRow.id,
    });
    if (locality.error || !locality.data) {
      console.error("Area resolve ensure_area(locality) failed:", {
        code: locality.error?.code,
        message: locality.error?.message,
        details: locality.error?.details,
        hint: locality.error?.hint,
      });
      return NextResponse.json({ error: "Could not resolve your area.", code: "server_error" }, { status: 502 });
    }
    const localityRow = Array.isArray(locality.data) ? locality.data[0] : locality.data;

    const { error: upsertError } = await supabase.from("profile_locations").upsert({
      user_id: userResult.user.id,
      h3_r8: h3r8,
      locality_area_id: localityRow.id,
      ward_area_id: wardRow.id,
      city_area_id: cityRow.id,
    }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Area resolve profile_locations upsert failed:", {
        code: (upsertError as { code?: string }).code,
        message: upsertError.message,
        details: (upsertError as { details?: string }).details,
        hint: (upsertError as { hint?: string }).hint,
      });
      return NextResponse.json({ error: "Could not save your area.", code: "server_error" }, { status: 502 });
    }

    return NextResponse.json({
      area: {
        locality: { id: localityRow.id, name: localityRow.name, h3: h3r8 },
        ward: { id: wardRow.id, name: wardRow.name, h3: h3r7 },
        city: { id: cityRow.id, name: cityRow.name, h3: h3r5 },
        centroid: { lat: localityRow.centroid_lat, lng: localityRow.centroid_lng },
      },
    });
  } catch (error) {
    console.error("Area resolve failed:", error);
    return NextResponse.json({ error: "Could not resolve your area.", code: "server_error" }, { status: 503 });
  }
}
