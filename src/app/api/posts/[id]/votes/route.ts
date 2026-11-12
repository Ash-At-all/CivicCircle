import { NextResponse } from "next/server";
import { z } from "zod";
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
  const rateLimitResponse = enforceRateLimit(request, "votes");
  if (rateLimitResponse) return rateLimitResponse;

  const id = await parsePostId(context);
  if (!id.success) return NextResponse.json({ error: "Invalid post ID." }, { status: 400 });
  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });
  const parsed = voteSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose an upvote, downvote, or remove your vote." }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();

    if (userResult?.user) {
      const { data, error } = await supabase.rpc("set_post_vote", {
        p_post_id: id.data,
        p_vote: parsed.data.vote,
      });
      if (!error && data) {
        const summary = Array.isArray(data) ? data[0] : data;
        return NextResponse.json({ score: Number(summary?.score ?? 0), vote: Number(summary?.my_vote ?? 0) });
      }
    }

    // Anonymous fallback: update votes count directly
    const { data: post } = await supabase.from("posts").select("votes").eq("id", id.data).maybeSingle();
    const currentScore = Number(post?.votes ?? 0);
    const newScore = Math.max(0, currentScore + parsed.data.vote);
    await supabase.from("posts").update({ votes: newScore }).eq("id", id.data);
    return NextResponse.json({ score: newScore, vote: parsed.data.vote });
  } catch (error) {
    console.error("Vote update is unavailable:", error);
    return NextResponse.json({ error: "Could not save your vote. Check Supabase configuration and try again." }, { status: 503 });
  }
}
