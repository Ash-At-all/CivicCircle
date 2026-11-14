import { NextResponse } from "next/server";
import { z } from "zod";
import { AREA_SCOPES } from "@/features/area/chat";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { loadAreaScope } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 256;
const scopeSchema = z.object({ scope: z.enum(AREA_SCOPES) }).strict();
const queryScopeSchema = z.enum(AREA_SCOPES);

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

  const parsed = scopeSchema.safeParse(payload.value);
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
        { error: "Sign in to share presence.", code: "auth_required" },
        { status: 401 },
      );
    }

    const areaResult = await loadAreaScope(
      supabase,
      userResult.user.id,
      parsed.data.scope,
    );
    if (!areaResult.ok) return areaResult.response;
    const { areaId, showPresence } = areaResult.context;

    if (!showPresence) {
      return NextResponse.json(
        {
          error: "Presence is off. Turn it on to appear in room counts.",
          code: "presence_off",
        },
        { status: 409 },
      );
    }

    const { error } = await supabase.rpc("heartbeat", { p_area_id: areaId });
    if (error) {
      const message = String(error.message || "").toLowerCase();

      if (message.includes("presence is off")) {
        return NextResponse.json(
          {
            error: "Presence is off. Turn it on to appear in room counts.",
            code: "presence_off",
          },
          { status: 409 },
        );
      }
      if (message.includes("presence rate limit")) {
        return NextResponse.json(
          {
            error: "Presence updated too often. It will retry shortly.",
            code: "rate_limited",
          },
          { status: 429, headers: { "Retry-After": "20" } },
        );
      }
      if (message.includes("area not allowed")) {
        return NextResponse.json(
          { error: "That room is not in your area.", code: "forbidden" },
          { status: 403 },
        );
      }
      if (message.includes("authentication required")) {
        return NextResponse.json(
          { error: "Sign in to share presence.", code: "auth_required" },
          { status: 401 },
        );
      }

      console.error("Presence heartbeat failed:", error);
      return NextResponse.json(
        { error: "Could not update presence.", code: "server_error" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Presence heartbeat failed:", error);
    return NextResponse.json(
      { error: "Could not update presence.", code: "server_error" },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const parsed = queryScopeSchema.safeParse(
    new URL(request.url).searchParams.get("scope") ?? "",
  );
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
        { error: "Sign in to update presence.", code: "auth_required" },
        { status: 401 },
      );
    }

    const areaResult = await loadAreaScope(
      supabase,
      userResult.user.id,
      parsed.data,
    );
    if (!areaResult.ok) return areaResult.response;

    const { error } = await supabase.rpc("leave_room_presence", {
      p_area_id: areaResult.context.areaId,
    });
    if (error) {
      console.error("Leave room presence failed:", error);
      return NextResponse.json(
        { error: "Could not update presence.", code: "server_error" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Leave room presence failed:", error);
    return NextResponse.json(
      { error: "Could not update presence.", code: "server_error" },
      { status: 503 },
    );
  }
}
