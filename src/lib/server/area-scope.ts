import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cellToParent } from "h3-js";
import type { AreaScope } from "@/features/area/chat";
import { RESOLUTIONS, validateAreaCell } from "@/features/area/h3";

export type OwnAreaIds = {
  locality: string;
  ward: string;
  city: string;
};

type ProfileLocationRow = {
  h3_r8: string;
  locality_area_id: string | null;
  ward_area_id: string | null;
  city_area_id: string | null;
  show_presence: boolean;
};

export type OwnAreaResult =
  | {
      ok: true;
      h3r8: string;
      areaIds: OwnAreaIds;
      showPresence: boolean;
    }
  | { ok: false; response: Response };

export async function loadOwnAreas(
  supabase: SupabaseClient,
  userId: string,
): Promise<OwnAreaResult> {
  const { data, error } = await supabase
    .from("profile_locations")
    .select("h3_r8, locality_area_id, ward_area_id, city_area_id, show_presence")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Could not load your area.", code: "server_error" },
        { status: 502 },
      ),
    };
  }

  const location = data as ProfileLocationRow | null;
  if (
    !location ||
    !location.locality_area_id ||
    !location.ward_area_id ||
    !location.city_area_id ||
    !validateAreaCell("locality", location.h3_r8)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Set your area to continue.", code: "invalid_area" },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    h3r8: location.h3_r8,
    areaIds: {
      locality: location.locality_area_id,
      ward: location.ward_area_id,
      city: location.city_area_id,
    },
    showPresence: Boolean(location.show_presence),
  };
}

export type AreaScopeContext = {
  areaId: string;
  h3Cell: string;
  areaIds: OwnAreaIds;
  showPresence: boolean;
};

export type AreaScopeResult =
  | { ok: true; context: AreaScopeContext }
  | { ok: false; response: Response };

export async function loadAreaScope(
  supabase: SupabaseClient,
  userId: string,
  scope: AreaScope,
): Promise<AreaScopeResult> {
  const ownArea = await loadOwnAreas(supabase, userId);
  if (!ownArea.ok) return ownArea;

  const h3Cell =
    scope === "locality"
      ? ownArea.h3r8
      : cellToParent(ownArea.h3r8, RESOLUTIONS[scope]);

  if (!validateAreaCell(scope, h3Cell)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your area could not be checked.", code: "invalid_area" },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      areaId: ownArea.areaIds[scope],
      h3Cell,
      areaIds: ownArea.areaIds,
      showPresence: ownArea.showPresence,
    },
  };
}
