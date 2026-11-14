import { NextResponse } from "next/server";
import { cellCentroid, validateAreaCell } from "@/features/area/h3";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json({ error: "Sign in to load nearby places.", code: "auth_required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "areaNearby");
    if (rateLimitResponse) return rateLimitResponse;

    const { data: location, error: locationError } = await supabase
      .from("profile_locations")
      .select("h3_r8, locality_area_id, ward_area_id, city_area_id, show_presence, locality:areas!profile_locations_locality_area_id_fkey(name)")
      .eq("user_id", userResult.user.id)
      .maybeSingle();

    if (locationError) {
      return NextResponse.json({ error: "Could not load your area.", code: "server_error" }, { status: 502 });
    }
    if (!location || !validateAreaCell("locality", location.h3_r8)) {
      return NextResponse.json({ error: "Set your area to continue.", code: "invalid_area" }, { status: 400 });
    }

    const centroid = cellCentroid(location.h3_r8);

    const [{ data: shops, error: shopsError }, { data: people, error: peopleError }] = await Promise.all([
      supabase.rpc("nearby_shops", { p_lat: centroid.lat, p_lng: centroid.lng, p_max_m: 50000 }),
      supabase.rpc("nearby_people", { p_lat: centroid.lat, p_lng: centroid.lng }),
    ]);

    if (shopsError || peopleError) {
      return NextResponse.json({ error: "Could not load nearby places.", code: "server_error" }, { status: 502 });
    }

    const localityName =
      location.locality && typeof location.locality === "object" && "name" in location.locality
        ? (location.locality as { name?: string }).name
        : undefined;

    return NextResponse.json({
      centroid,
      localityName: localityName || "Your area",
      shops: shops ?? [],
      people: people ?? [],
      showPresence: Boolean(location.show_presence),
      areaIds: {
        locality: location.locality_area_id,
        ward: location.ward_area_id,
        city: location.city_area_id,
      },
    });
  } catch (error) {
    console.error("Nearby load failed:", error);
    return NextResponse.json({ error: "Could not load nearby places.", code: "server_error" }, { status: 503 });
  }
}
