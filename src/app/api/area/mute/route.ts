import { NextResponse } from "next/server";
import { z } from "zod";
import { AREA_SCOPES, type AreaScope } from "@/features/area/chat";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { loadAreaScope, loadOwnAreas } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 256;
const muteSchema = z.object({ scope: z.enum(AREA_SCOPES) }).strict();

function emptyMutes(): Record<AreaScope, boolean> {
  return { locality: false, ward: false, city: false };
}

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to view muted rooms.", code: "auth_required" },
        { status: 401 },
      );
    }

    const ownArea = await loadOwnAreas(supabase, userResult.user.id);
    if (!ownArea.ok) return ownArea.response;

    const { data, error } = await supabase
      .from("area_mutes")
      .select("area_id")
      .eq("user_id", userResult.user.id)
      .in("area_id", [
        ownArea.areaIds.locality,
        ownArea.areaIds.ward,
        ownArea.areaIds.city,
      ]);

    if (error) {
      return NextResponse.json(
        { error: "Could not load muted rooms.", code: "server_error" },
        { status: 502 },
      );
    }

    const mutedIds = new Set(
      (data ?? []).map((row: { area_id: string }) => row.area_id),
    );
    const muted = emptyMutes();
    for (const scope of AREA_SCOPES) {
      muted[scope] = mutedIds.has(ownArea.areaIds[scope]);
    }

    return NextResponse.json({ muted });
  } catch (error) {
    console.error("Mute list load failed:", error);
    return NextResponse.json(
      { error: "Could not load muted rooms.", code: "server_error" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) {
    return NextResponse.json(
      { error: payload.error, code: "invalid_request" },
      { status: payload.status },
    );
  }

  const parsed = muteSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose a valid room.", code: "invalid_request" },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to mute a room.", code: "auth_required" },
        { status: 401 },
      );
    }

    const areaResult = await loadAreaScope(
      supabase,
      userResult.user.id,
      parsed.data.scope,
    );
    if (!areaResult.ok) return areaResult.response;
    const { areaId } = areaResult.context;

    const rateLimitResponse = await enforceRateLimit(supabase, "areaMute", areaId);
    if (rateLimitResponse) return rateLimitResponse;

    const { error } = await supabase.from("area_mutes").upsert(
      {
        user_id: userResult.user.id,
        area_id: areaId,
      },
      { onConflict: "user_id,area_id", ignoreDuplicates: true },
    );

    if (error) {
      console.error("Mute room failed:", error);
      return NextResponse.json(
        { error: "Could not mute this room.", code: "server_error" },
        { status: 502 },
      );
    }

    return NextResponse.json({ scope: parsed.data.scope, muted: true });
  } catch (error) {
    console.error("Mute room failed:", error);
    return NextResponse.json(
      { error: "Could not mute this room.", code: "server_error" },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) {
    return NextResponse.json(
      { error: payload.error, code: "invalid_request" },
      { status: payload.status },
    );
  }

  const parsed = muteSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose a valid room.", code: "invalid_request" },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to unmute a room.", code: "auth_required" },
        { status: 401 },
      );
    }

    const areaResult = await loadAreaScope(
      supabase,
      userResult.user.id,
      parsed.data.scope,
    );
    if (!areaResult.ok) return areaResult.response;
    const { areaId } = areaResult.context;

    const rateLimitResponse = await enforceRateLimit(supabase, "areaMute", areaId);
    if (rateLimitResponse) return rateLimitResponse;

    const { error } = await supabase
      .from("area_mutes")
      .delete()
      .eq("user_id", userResult.user.id)
      .eq("area_id", areaId);

    if (error) {
      console.error("Unmute room failed:", error);
      return NextResponse.json(
        { error: "Could not unmute this room.", code: "server_error" },
        { status: 502 },
      );
    }

    return NextResponse.json({ scope: parsed.data.scope, muted: false });
  } catch (error) {
    console.error("Unmute room failed:", error);
    return NextResponse.json(
      { error: "Could not unmute this room.", code: "server_error" },
      { status: 503 },
    );
  }
}
