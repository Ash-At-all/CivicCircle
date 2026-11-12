import { NextResponse } from "next/server";
import { z } from "zod";
import { commentDraftSchema } from "@/lib/post-schema";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 4096;
const uuidSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getPostId(context: RouteContext) {
  const { id } = await context.params;
  return uuidSchema.safeParse(id);
}

export async function GET(_request: Request, context: RouteContext) {
  const id = await getPostId(context);
  if (!id.success) return NextResponse.json({ error: "Invalid post ID." }, { status: 400 });

  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("post_comments")
      .select("id, post_id, parent_id, author_id, body, created_at, profiles(username, display_name)")
      .eq("post_id", id.data)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase comments list failed:", error.message);
      return NextResponse.json({ error: "Could not load comments. Please try again." }, { status: 502 });
    }

    type CommentRow = {
      id: string;
      post_id: string;
      parent_id: string | null;
      author_id: string | null;
      body: string;
      created_at: string;
      profiles: { username: string; display_name: string | null } | null;
    };

    const rows = (data ?? []) as unknown as CommentRow[];
    const comments = rows.map((row) => ({
      id: row.id,
      post_id: row.post_id,
      parent_id: row.parent_id,
      author: row.profiles?.display_name || row.profiles?.username || "Community member",
      author_username: row.profiles?.username ?? null,
      body: row.body,
      created_at: row.created_at,
    }));

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Supabase comments list is unavailable:", error);
    return NextResponse.json({ error: "Could not load comments. Check Supabase configuration and try again." }, { status: 503 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const rateLimitResponse = enforceRateLimit(request, "comments");
  if (rateLimitResponse) return rateLimitResponse;

  const id = await getPostId(context);
  if (!id.success) return NextResponse.json({ error: "Invalid post ID." }, { status: 400 });

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const schema = commentDraftSchema.extend({
    parentId: z.string().uuid().nullable().optional(),
    authorName: z.string().max(50).optional(),
    anonId: z.string().optional(),
  }).strict();
  const parsed = schema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id")
      .eq("id", id.data)
      .maybeSingle();
    if (postError) {
      console.error("Supabase comment post lookup failed:", postError.message);
      return NextResponse.json({ error: "Could not verify the post. Please try again." }, { status: 502 });
    }
    if (!post) return NextResponse.json({ error: "The post no longer exists." }, { status: 404 });

    if (parsed.data.parentId) {
      const { data: parent, error: parentError } = await supabase
        .from("post_comments")
        .select("id")
        .eq("id", parsed.data.parentId)
        .eq("post_id", id.data)
        .maybeSingle();
      if (parentError) {
        console.error("Supabase comment parent lookup failed:", parentError.message);
        return NextResponse.json({ error: "Could not reply to this comment. Please try again." }, { status: 502 });
      }
      if (!parent) return NextResponse.json({ error: "The comment you are replying to was not found." }, { status: 404 });
    }

    let profile = null;
    if (userResult?.user?.id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", userResult.user.id)
        .maybeSingle();
      profile = p;
    }

    const { data: row, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: id.data,
        parent_id: parsed.data.parentId ?? null,
        author_id: userResult?.user?.id ?? null,
        body: parsed.data.body,
      })
      .select("id, created_at")
      .single();
    if (error) {
      console.error("Supabase comment create failed:", error.message);
      return NextResponse.json({ error: "Could not publish your comment. Please try again." }, { status: 502 });
    }

    return NextResponse.json({
      comment: {
        id: row.id,
        post_id: id.data,
        parent_id: parsed.data.parentId ?? null,
        author: profile?.display_name || profile?.username || parsed.data.authorName || "Community member",
        author_username: profile?.username ?? null,
        body: parsed.data.body,
        created_at: row.created_at,
        replies: [],
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Supabase comment create is unavailable:", error);
    return NextResponse.json({ error: "Could not publish your comment. Check Supabase configuration and try again." }, { status: 503 });
  }
}
