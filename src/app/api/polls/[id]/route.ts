import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PollRow = {
  id: string;
  post_id: string;
  question: string;
  created_at: string;
  expires_at: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json({ error: "Sign in to view polls.", code: "auth_required" }, { status: 401 });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "pollRead");
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

    const { data: options, error: optionsError } = await supabase
      .from("poll_options")
      .select("id, text")
      .eq("poll_id", id)
      .order("created_at", { ascending: true });

    if (optionsError) {
      console.error("Supabase poll options lookup failed:", optionsError.message);
      return NextResponse.json({ error: "Could not load the poll options. Please try again." }, { status: 502 });
    }

    const { data: votes, error: votesError } = await supabase
      .from("poll_votes")
      .select("option_id")
      .eq("poll_id", id);

    if (votesError) {
      console.error("Supabase poll votes lookup failed:", votesError.message);
      return NextResponse.json({ error: "Could not load the poll results. Please try again." }, { status: 502 });
    }

    const rows = (votes ?? []) as Array<{ option_id: string }>;
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = String(row.option_id);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const totalVotes = rows.length;

    const optionsWithResults = ((options ?? []) as Array<{ id: string; text: string }>).map((option) => {
      const optionVotes = counts.get(String(option.id)) ?? 0;
      const percent = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
      return { id: String(option.id), text: String(option.text), votes: optionVotes, percent };
    });

    const pollRow = poll as PollRow;
    const closed = new Date(pollRow.expires_at).getTime() <= Date.now();

    const result = {
      poll: {
        id: pollRow.id,
        post_id: pollRow.post_id,
        question: pollRow.question,
        created_at: pollRow.created_at,
        expires_at: pollRow.expires_at,
      },
      options: optionsWithResults,
      votes: totalVotes,
      closed,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Poll lookup is unavailable:", error);
    return NextResponse.json({ error: "Could not load the poll. Please try again." }, { status: 503 });
  }
}
