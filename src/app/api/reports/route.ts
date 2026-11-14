import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceSameOrigin } from "@/lib/server/origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { loadOwnAreas } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 4 * 1024;
const reportSchema = z.object({
  type: z.enum(["post", "comment", "message"]),
  targetId: z.string().uuid(),
  reason: z.enum(["harassment", "hate", "spam", "personal-information", "violence", "other"]),
  details: z.string().trim().max(500).default(""),
}).strict();
const reportStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["reviewed", "actioned"]),
}).strict();

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json({ isModerator: false, reports: [] });
    }
    const isModerator = ["moderator", "admin"].includes(String(userResult.user.app_metadata?.role ?? ""));
    const { data, error } = await supabase
      .from("reports")
      .select("id, post_id, comment_id, message_id, reason, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      return NextResponse.json({ isModerator, reports: [] });
    }
    const rows = data ?? [];
    return NextResponse.json({
      isModerator,
      reports: rows.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => ({
        id: r.id,
        type: r.post_id ? "post" : r.comment_id ? "comment" : r.message_id ? "message" : "post",
        targetId: r.post_id ?? r.comment_id ?? r.message_id,
        targetContent: "",
        reason: r.reason,
        details: r.details,
        status: r.status,
      })),
    });
  } catch (error) {
    console.error("Report list error:", error);
    return NextResponse.json({ isModerator: false, reports: [] });
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = reportSchema.safeParse(payload.value);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid reason for the report." }, { status: 400 });

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) return NextResponse.json({ error: "Sign in to submit a report.", code: "auth_required" }, { status: 401 });

    const rateLimitResponse = await enforceRateLimit(
      supabase,
      parsed.data.type === "message" ? "areaReport" : "reports",
    );
    if (rateLimitResponse) return rateLimitResponse;

    if (parsed.data.type === "message") {
      const ownArea = await loadOwnAreas(supabase, userResult.user.id);
      if (!ownArea.ok) return ownArea.response;

      const { data: message, error: messageError } = await supabase
        .from("messages")
        .select("id")
        .eq("id", parsed.data.targetId)
        .in("area_id", [
          ownArea.areaIds.locality,
          ownArea.areaIds.ward,
          ownArea.areaIds.city,
        ])
        .is("deleted_at", null)
        .maybeSingle();

      if (messageError) {
        return NextResponse.json({ error: "Could not submit your report. Please try again." }, { status: 502 });
      }
      if (!message) {
        return NextResponse.json({ error: "That message is not available to report." }, { status: 404 });
      }
    }

    const insert: Record<string, unknown> = {
      reporter_id: userResult.user.id,
      reason: parsed.data.reason,
      details: parsed.data.details,
      post_id: parsed.data.type === "post" ? parsed.data.targetId : null,
      comment_id: parsed.data.type === "comment" ? parsed.data.targetId : null,
      message_id: parsed.data.type === "message" ? parsed.data.targetId : null,
    };

    const { data, error } = await supabase.from("reports").insert(insert).select("id, reason, details, status").single();
    if (error || !data) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "23505") {
        return NextResponse.json({ error: "You have already reported this." }, { status: 409 });
      }
      return NextResponse.json({ error: "Could not submit your report. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ report: data }, { status: 201 });
  } catch (error) {
    console.error("Report submit error:", error);
    return NextResponse.json({ error: "Could not submit your report. Please try again." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = reportStatusSchema.safeParse(payload.value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid report update." }, { status: 400 });

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) return NextResponse.json({ error: "Sign in to update a report.", code: "auth_required" }, { status: 401 });
    const rateLimitResponse = await enforceRateLimit(supabase, "reports");
    if (rateLimitResponse) return rateLimitResponse;

    const { data, error } = await supabase
      .from("reports")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.id)
      .select("id, status")
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Could not update that report." }, { status: 403 });
    return NextResponse.json({ report: data });
  } catch (error) {
    console.error("Report update error:", error);
    return NextResponse.json({ error: "Could not update that report." }, { status: 503 });
  }
}


