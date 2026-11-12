import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 4 * 1024;
const reportSchema = z.object({
  type: z.enum(["post", "comment"]),
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
      .select("id, post_id, comment_id, reason, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      return NextResponse.json({ isModerator, reports: [] });
    }
    const rows = data ?? [];
    return NextResponse.json({
      isModerator,
      reports: rows.map((r) => ({
        id: r.id,
        type: r.post_id ? "post" : "comment",
        targetId: r.post_id ?? r.comment_id,
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
  const rateLimitResponse = enforceRateLimit(request, "reports");
  if (rateLimitResponse) return rateLimitResponse;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = reportSchema.safeParse(payload.value);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid reason for the report." }, { status: 400 });

  return NextResponse.json({
    report: {
      id: crypto.randomUUID(),
      reason: parsed.data.reason,
      details: parsed.data.details,
      status: "open",
    },
  }, { status: 201 });
}

export async function PATCH(request: Request) {
  const rateLimitResponse = enforceRateLimit(request, "reports");
  if (rateLimitResponse) return rateLimitResponse;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = reportStatusSchema.safeParse(payload.value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid report update." }, { status: 400 });

  return NextResponse.json({ report: { id: parsed.data.id, status: parsed.data.status } });
}
