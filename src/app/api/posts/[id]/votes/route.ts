import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 1024;
const uuidSchema = z.string().uuid();
const voteSchema = z.object({
  vote: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
}).strict();

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parsePostId(context: RouteContext) {
  const { id } = await context.params;
  return uuidSchema.safeParse(id);
}

export async function PUT(request: Request, context: RouteContext) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const id = await parsePostId(context);
  if (!id.success) return NextResponse.json({ error: "Invalid post ID.", code: "invalid_request" }, { status: 400 });
  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });
  const parsed = voteSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose an upvote, downvote, or remove your vote." }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) return NextResponse.json({ error: "Sign in to vote.", code: "auth_required" }, { status: 401 });
    const rateLimitResponse = await enforceRateLimit(supabase, "votes");
    if (rateLimitResponse) return rateLimitResponse;

    const { data, error } = await supabase.rpc("set_post_vote", {
      p_post_id: id.data,
      p_vote: parsed.data.vote,
    });
    if (error) {
      const message = String(error.message || "").toLowerCase();
      console.error("Vote update failed", {
        code: (error as { code?: string }).code,
        message: error.message,
      });
      if (message.includes("post not found")) {
        return NextResponse.json(
          { error: "This post no longer exists.", code: "post_not_found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Could not save your vote. Please try again.", code: "vote_failed" },
        { status: 502 },
      );
    }
    const summary = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ score: Number(summary?.score ?? 0), vote: Number(summary?.my_vote ?? 0) });
  } catch (error) {
    console.error("Vote update is unavailable:", error);
    return NextResponse.json(
      { error: "Voting is temporarily unavailable. Please try again shortly.", code: "vote_unavailable" },
      { status: 503 },
    );
  }
}

