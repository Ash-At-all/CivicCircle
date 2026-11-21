import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceSameOrigin } from "@/lib/server/origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { loadOwnAreas } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 4 * 1024;
const reportSchema = z.object({
  type: z.enum(["post", "comment", "message", "review"]),
  targetId: z.string().uuid(),
  reason: z.enum(["harassment", "hate", "spam", "personal-information", "violence", "other"]),
  details: z.string().trim().max(500).default(""),
}).strict();
const reportStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["reviewed", "actioned"]),
}).strict();

type ReportType = "post" | "comment" | "message" | "review";

type ReportRow = {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  message_id: string | null;
  review_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

function reportType(row: ReportRow): ReportType {
  if (row.post_id) return "post";
  if (row.comment_id) return "comment";
  if (row.message_id) return "message";
  return "review";
}

function targetIdOf(row: ReportRow): string {
  return row.post_id ?? row.comment_id ?? row.message_id ?? row.review_id ?? "";
}

function previewText(value: string | null | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

async function loadPreviews(
  supabase: SupabaseServerClient,
  table: "posts" | "post_comments" | "messages" | "area_reviews",
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, string>();
  const columns = table === "posts" ? "id, title, body" : "id, body";
  const { data, error } = await supabase.from(table).select(columns).in("id", ids);
  if (error) return new Map<string, string>();
  const map = new Map<string, string>();
  for (const row of (data ?? []) as unknown[]) {
    const record = row as { id: string; title?: string; body?: string };
    map.set(record.id, previewText(record.title ? `${record.title} ${record.body ?? ""}` : record.body));
  }
  return map;
}

function emptyAnalytics() {
  return {
    total: 0,
    open: 0,
    reviewed: 0,
    actioned: 0,
    byReason: {} as Record<string, number>,
    byType: {} as Record<string, number>,
  };
}

export async function GET(request: Request) {
  const metaOnly = new URL(request.url).searchParams.get("meta") === "1";
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      if (metaOnly) return NextResponse.json({ isModerator: false });
      return NextResponse.json({ isModerator: false, reports: [], analytics: emptyAnalytics() });
    }
    const isModerator = ["moderator", "admin"].includes(String(userResult.user.app_metadata?.role ?? ""));
    if (metaOnly) {
      return NextResponse.json({ isModerator });
    }
    const { data, error } = await supabase
      .from("reports")
      .select("id, post_id, comment_id, message_id, review_id, reason, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      return NextResponse.json({ isModerator, reports: [], analytics: emptyAnalytics() });
    }

    const rows = (data ?? []) as ReportRow[];
    const ids: Record<ReportType, string[]> = { post: [], comment: [], message: [], review: [] };
    for (const row of rows) {
      ids[reportType(row)].push(targetIdOf(row));
    }

    const [postPreviews, commentPreviews, messagePreviews, reviewPreviews] = await Promise.all([
      loadPreviews(supabase, "posts", ids.post),
      loadPreviews(supabase, "post_comments", ids.comment),
      loadPreviews(supabase, "messages", ids.message),
      loadPreviews(supabase, "area_reviews", ids.review),
    ]);
    const previews: Record<ReportType, Map<string, string>> = {
      post: postPreviews,
      comment: commentPreviews,
      message: messagePreviews,
      review: reviewPreviews,
    };

    const byReason: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const row of rows) {
      byReason[row.reason] = (byReason[row.reason] ?? 0) + 1;
      const type = reportType(row);
      byType[type] = (byType[type] ?? 0) + 1;
    }

    return NextResponse.json({
      isModerator,
      analytics: {
        total: rows.length,
        open: rows.filter((row) => row.status === "open").length,
        reviewed: rows.filter((row) => row.status === "reviewed").length,
        actioned: rows.filter((row) => row.status === "actioned").length,
        byReason,
        byType,
      },
      reports: rows.map((row) => {
        const type = reportType(row);
        const targetId = targetIdOf(row);
        return {
          id: row.id,
          type,
          targetId,
          targetContent: previews[type].get(targetId) ?? "",
          reason: row.reason,
          details: row.details ?? "",
          status: row.status,
          created_at: row.created_at,
        };
      }),
    });
  } catch (error) {
    console.error("Report list error:", error);
    return NextResponse.json({ isModerator: false, reports: [], analytics: emptyAnalytics() });
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
      parsed.data.type === "message" || parsed.data.type === "review"
        ? "areaReport"
        : "reports",
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

    if (parsed.data.type === "review") {
      const ownArea = await loadOwnAreas(supabase, userResult.user.id);
      if (!ownArea.ok) return ownArea.response;

      const { data: review, error: reviewError } = await supabase
        .from("area_reviews")
        .select("id, user_id")
        .eq("id", parsed.data.targetId)
        .in("area_id", [
          ownArea.areaIds.locality,
          ownArea.areaIds.ward,
          ownArea.areaIds.city,
        ])
        .maybeSingle();

      if (reviewError) {
        return NextResponse.json({ error: "Could not submit your report. Please try again." }, { status: 502 });
      }
      if (!review) {
        return NextResponse.json({ error: "That review is not available to report." }, { status: 404 });
      }
      if ((review as { user_id: string }).user_id === userResult.user.id) {
        return NextResponse.json(
          { error: "You cannot report your own review.", code: "forbidden" },
          { status: 403 },
        );
      }
    }

    const insert: Record<string, unknown> = {
      reporter_id: userResult.user.id,
      reason: parsed.data.reason,
      details: parsed.data.details,
      post_id: parsed.data.type === "post" ? parsed.data.targetId : null,
      comment_id: parsed.data.type === "comment" ? parsed.data.targetId : null,
      message_id: parsed.data.type === "message" ? parsed.data.targetId : null,
      review_id: parsed.data.type === "review" ? parsed.data.targetId : null,
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


