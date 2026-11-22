import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin } from "@/lib/server/origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parsePostId(context: RouteContext) {
  const { id } = await context.params;
  return uuidSchema.safeParse(id);
}

async function readHelpfulCount(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  postId: string,
) {
  const { count, error } = await supabase
    .from("helpful_marks")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (error) {
    console.error("Helpful count lookup failed:", error.message);
    return null;
  }
  return count ?? 0;
}

export async function POST(request: Request, context: RouteContext) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const id = await parsePostId(context);
  if (!id.success) {
    return NextResponse.json({ error: "Invalid post ID.", code: "invalid_request" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to mark a post as helpful.", code: "auth_required" },
        { status: 401 },
      );
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "helpfulMarks");
    if (rateLimitResponse) return rateLimitResponse;

    const { error } = await supabase
      .from("helpful_marks")
      .insert({ post_id: id.data, user_id: userResult.user.id });

    if (error && error.code !== "23505") {
      console.error("Helpful mark failed", { code: error.code, message: error.message });
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "This post no longer exists.", code: "post_not_found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Could not save your helpful mark. Please try again.", code: "helpful_failed" },
        { status: 502 },
      );
    }

    const helpfulCount = await readHelpfulCount(supabase, id.data);
    return NextResponse.json({ marked: true, helpfulCount });
  } catch (error) {
    console.error("Helpful mark is unavailable:", error);
    return NextResponse.json(
      { error: "Marking helpful posts is temporarily unavailable. Please try again shortly.", code: "helpful_unavailable" },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const id = await parsePostId(context);
  if (!id.success) {
    return NextResponse.json({ error: "Invalid post ID.", code: "invalid_request" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to remove your helpful mark.", code: "auth_required" },
        { status: 401 },
      );
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "helpfulMarks");
    if (rateLimitResponse) return rateLimitResponse;

    const { error } = await supabase
      .from("helpful_marks")
      .delete()
      .eq("post_id", id.data)
      .eq("user_id", userResult.user.id);

    if (error) {
      console.error("Helpful unmark failed", { code: error.code, message: error.message });
      return NextResponse.json(
        { error: "Could not remove your helpful mark. Please try again.", code: "helpful_failed" },
        { status: 502 },
      );
    }

    const helpfulCount = await readHelpfulCount(supabase, id.data);
    return NextResponse.json({ marked: false, helpfulCount });
  } catch (error) {
    console.error("Helpful unmark is unavailable:", error);
    return NextResponse.json(
      { error: "Marking helpful posts is temporarily unavailable. Please try again shortly.", code: "helpful_unavailable" },
      { status: 503 },
    );
  }
}
