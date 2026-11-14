import { NextResponse } from "next/server";
import { z } from "zod";
import { postEditSchema } from "@/features/posts/schema";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 16 * 1024;
const POST_COLUMNS = "id, city_slug, title, body, tag, image_paths, created_at, updated_at";
const uuidSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getPostId(context: RouteContext) {
  const { id } = await context.params;
  return uuidSchema.safeParse(id);
}

export async function PUT(request: Request, context: RouteContext) {
  const id = await getPostId(context);
  if (!id.success) return NextResponse.json({ error: "Invalid post ID." }, { status: 400 });

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = postEditSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) return NextResponse.json({ error: "Sign in to edit a post.", code: "auth_required" }, { status: 401 });
    const rateLimitResponse = await enforceRateLimit(supabase, "posts");
    if (rateLimitResponse) return rateLimitResponse;

    const { data, error } = await supabase
      .from("posts")
      .update({ title: parsed.data.title, body: parsed.data.body })
      .eq("id", id.data)
      .select(POST_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("Supabase post update failed:", error.message);
      return NextResponse.json({ error: "Could not update your post. Please try again." }, { status: 502 });
    }
    if (!data) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    return NextResponse.json({ post: { ...data, mine: true } });
  } catch (error) {
    console.error("Supabase post update is unavailable:", error);
    return NextResponse.json({ error: "Supabase is not available. Check server configuration and try again." }, { status: 503 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const id = await getPostId(context);
  if (!id.success) return NextResponse.json({ error: "Invalid post ID." }, { status: 400 });

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) return NextResponse.json({ error: "Sign in to delete a post.", code: "auth_required" }, { status: 401 });
    const rateLimitResponse = await enforceRateLimit(supabase, "posts");
    if (rateLimitResponse) return rateLimitResponse;

    const { data: post, error: readError } = await supabase
      .from("posts")
      .select("id, image_paths")
      .eq("id", id.data)
      .maybeSingle();

    if (readError) {
      console.error("Supabase post lookup for deletion failed:", readError.message);
      return NextResponse.json({ error: "Could not delete your post. Please try again." }, { status: 502 });
    }
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .eq("id", id.data);

    if (deleteError) {
      console.error("Supabase post delete failed:", deleteError.message);
      return NextResponse.json({ error: "Could not delete your post. Please try again." }, { status: 502 });
    }

    if (post.image_paths && Array.isArray(post.image_paths) && post.image_paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("post-images")
        .remove(post.image_paths);
      if (storageError) console.error("Supabase post images cleanup failed:", storageError.message);
    }

    return NextResponse.json({ id: id.data });
  } catch (error) {
    console.error("Supabase post delete is unavailable:", error);
    return NextResponse.json({ error: "Supabase is not available. Check server configuration and try again." }, { status: 503 });
  }
}

