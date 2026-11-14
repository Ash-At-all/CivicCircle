import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 512;
const patchSchema = z.object({ showPresence: z.boolean() }).strict();

export async function PATCH(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error, code: "invalid_request" }, { status: payload.status });
  const parsed = patchSchema.safeParse(payload.value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json({ error: "Sign in to update your area.", code: "auth_required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "areaLocationClear");
    if (rateLimitResponse) return rateLimitResponse;

    const { error } = await supabase
      .from("profile_locations")
      .update({ show_presence: parsed.data.showPresence })
      .eq("user_id", userResult.user.id);

    if (error) {
      return NextResponse.json({ error: "Could not update presence preference.", code: "server_error" }, { status: 502 });
    }

    return NextResponse.json({ showPresence: parsed.data.showPresence });
  } catch (error) {
    console.error("Presence preference update failed:", error);
    return NextResponse.json({ error: "Could not update presence preference.", code: "server_error" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json({ error: "Sign in to clear your area.", code: "auth_required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "areaLocationClear");
    if (rateLimitResponse) return rateLimitResponse;

    await supabase.rpc("stop_presence");
    const { error } = await supabase.from("profile_locations").delete().eq("user_id", userResult.user.id);
    if (error) {
      return NextResponse.json({ error: "Could not clear your area.", code: "server_error" }, { status: 502 });
    }

    return NextResponse.json({ cleared: true });
  } catch (error) {
    console.error("Clear area failed:", error);
    return NextResponse.json({ error: "Could not clear your area.", code: "server_error" }, { status: 503 });
  }
}
