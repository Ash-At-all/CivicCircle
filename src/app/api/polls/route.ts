import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_POLL_OPTIONS = 4;
const MAX_OPTION_LENGTH = 120;
const MAX_QUESTION_LENGTH = 160;
const POLL_DURATION_MS = 24 * 60 * 60 * 1000;

const createPollSchema = z
  .object({
    postId: z.string().uuid(),
    question: z.string().trim().min(1, "Poll question is required").max(MAX_QUESTION_LENGTH, "Poll question must be 160 characters or fewer"),
    options: z
      .array(z.string().trim().min(1, "Poll options cannot be empty").max(MAX_OPTION_LENGTH, "Poll options must be 120 characters or fewer"))
      .min(2, "A poll needs at least 2 options")
      .max(MAX_POLL_OPTIONS, "A poll can have up to 4 options"),
  })
  .strict();

export async function POST(request: Request) {
  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = createPollSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json({ error: "Sign in to create a poll.", code: "auth_required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "pollCreate");
    if (rateLimitResponse) return rateLimitResponse;

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id")
      .eq("id", parsed.data.postId)
      .maybeSingle();
    if (postError) {
      console.error("Supabase poll post lookup failed:", postError.message);
      return NextResponse.json({ error: "Could not create the poll. Please try again." }, { status: 502 });
    }
    if (!post) {
      return NextResponse.json({ error: "The post for this poll was not found." }, { status: 404 });
    }

    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({
        post_id: parsed.data.postId,
        question: parsed.data.question,
        expires_at: new Date(Date.now() + POLL_DURATION_MS).toISOString(),
      })
      .select("id, post_id, question, created_at, expires_at")
      .single();

    if (pollError || !poll) {
      console.error("Supabase poll create failed:", pollError?.message);
      return NextResponse.json({ error: pollError?.message || "Could not create the poll." }, { status: 502 });
    }

    const optionInserts = parsed.data.options.map((text) => ({
      poll_id: (poll as { id: string }).id,
      text,
    }));
    const { data: options, error: optionsError } = await supabase
      .from("poll_options")
      .insert(optionInserts)
      .select("id, text");

    if (optionsError) {
      console.error("Supabase poll options create failed:", optionsError.message);
      return NextResponse.json({ error: "Could not create the poll options." }, { status: 502 });
    }

    const createdPoll = poll as { id: string; created_at: string; expires_at: string };
    return NextResponse.json(
      {
        poll: {
          id: createdPoll.id,
          post_id: parsed.data.postId,
          question: parsed.data.question,
          created_at: createdPoll.created_at,
          expires_at: createdPoll.expires_at,
          options: (options ?? []).map((o) => ({ id: String(o.id), text: String(o.text) })),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Poll create is unavailable:", error);
    return NextResponse.json({ error: "Could not create the poll. Please try again." }, { status: 503 });
  }
}
