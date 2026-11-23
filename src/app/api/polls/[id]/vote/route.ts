import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 16 * 1024;

const voteSchema = z.object({ option_id: z.string().uuid() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = voteSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json({ error: "Sign in to vote on polls.", code: "auth_required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "pollVote");
    if (rateLimitResponse) return rateLimitResponse;

    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("id, post_id, question, created_at, expires_at")
      .eq("id", id)
      .maybeSingle();

    if (pollError) {
      console.error("Supabase poll lookup failed:", pollError.message);
      return NextResponse.json({ error: "Could not load the poll. Please try again." }, { status: 502 });
    }
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    const pollRow = poll as { id: string; expires_at: string };
    const closed = new Date(pollRow.expires_at).getTime() <= Date.now();
    if (closed) {
      return NextResponse.json({ error: "This poll has closed.", code: "poll_closed" }, { status: 400 });
    }

    const { data: option, error: optionError } = await supabase
      .from("poll_options")
      .select("id, poll_id, text")
      .eq("id", parsed.data.option_id)
      .maybeSingle();

    if (optionError) {
      console.error("Supabase poll option lookup failed:", optionError.message);
      return NextResponse.json({ error: "Could not load the poll options. Please try again." }, { status: 502 });
    }
    if (!option) {
      return NextResponse.json({ error: "Poll option not found." }, { status: 404 });
    }
    const optionRow = option as { id: string; poll_id: string; text: string };
    if (optionRow.poll_id !== pollRow.id) {
      return NextResponse.json({ error: "Poll option does not belong to this poll." }, { status: 400 });
    }

    const { data: existingVote } = await supabase
      .from("poll_votes")
      .select("id, poll_id, option_id, user_id, created_at")
      .eq("poll_id", id)
      .eq("user_id", userResult.user.id)
      .maybeSingle();

    if (existingVote) {
      return NextResponse.json({ error: "You have already voted on this poll.", code: "poll_already_voted" }, { status: 409 });
    }

    const { error: insertError } = await supabase.from("poll_votes").insert({
      poll_id: id,
      option_id: parsed.data.option_id,
      user_id: userResult.user.id,
    });

    if (insertError) {
      console.error("Supabase poll vote failed:", insertError.message);
      if ((insertError as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "You have already voted on this poll.", code: "poll_already_voted" }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message || "Could not submit your vote." }, { status: 502 });
    }

    const { data: optionsAfter } = await supabase
      .from("poll_options")
      .select("id, text")
      .eq("poll_id", id)
      .order("created_at", { ascending: true });
    const { data: votesAfter } = await supabase.from("poll_votes").select("option_id").eq("poll_id", id);

    const rows = (votesAfter ?? []) as Array<{ option_id: string }>;
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = String(row.option_id);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const totalVotes = rows.length;

    const optionsWithResults = ((optionsAfter ?? []) as Array<{ id: string; text: string }>).map((option) => {
      const optionVotes = counts.get(String(option.id)) ?? 0;
      const percent = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
      return { id: String(option.id), text: String(option.text), votes: optionVotes, percent };
    });

    const { data: pollAfter } = await supabase.from("polls").select("id, post_id, question, created_at, expires_at").eq("id", id).maybeSingle();
    const pollRowAfter = (pollAfter ?? poll) as { id: string; post_id: string; question: string; created_at: string; expires_at: string };

    return NextResponse.json({
      poll: {
        id: pollRowAfter.id,
        post_id: pollRowAfter.post_id,
        question: pollRowAfter.question,
        created_at: pollRowAfter.created_at,
        expires_at: pollRowAfter.expires_at,
      },
      options: optionsWithResults,
      votes: totalVotes,
      closed: new Date(pollRowAfter.expires_at).getTime() <= Date.now(),
    });
  } catch (error) {
    console.error("Poll vote is unavailable:", error);
    return NextResponse.json({ error: "Could not submit your vote. Please try again." }, { status: 503 });
  }
}
