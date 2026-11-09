import { NextResponse } from "next/server";
import { citySlugSchema, postCreateRequestSchema } from "@/lib/post-schema";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 16 * 1024;

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get("city");
  const author = new URL(request.url).searchParams.get("author");
  if (city) {
    const parsedCity = citySlugSchema.safeParse(city);
    if (!parsedCity.success) {
      return NextResponse.json({ error: "Choose a valid topic." }, { status: 400 });
    }
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    const currentUserId = userResult?.user?.id ?? null;

    // 1. Try querying `posts` with anon_id & author_id
    let queryWithAnon = supabase
      .from("posts")
      .select("id, city_slug, author_id, anon_id, tag, title, body, image_paths, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (city) queryWithAnon = queryWithAnon.eq("city_slug", city);
    if (author) queryWithAnon = queryWithAnon.eq("anon_id", author);

    const { data: postsData, error: postsError } = await queryWithAnon;

    if (!postsError && postsData) {
      const posts = postsData.map((p) => ({
        ...p,
        mine: Boolean(currentUserId && (p.author_id === currentUserId || p.anon_id === currentUserId)),
      }));
      return NextResponse.json({ posts });
    }

    // 2. If anon_id or posts table query failed, fallback to `posts_public` view
    console.warn("Direct posts query failed, falling back to posts_public:", postsError?.message);
    let fallbackQuery = supabase
      .from("posts_public")
      .select("id, city_slug, tag, title, body, image_paths, created_at, updated_at, author, author_username")
      .order("created_at", { ascending: false });
    if (city) fallbackQuery = fallbackQuery.eq("city_slug", city);

    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (!fallbackError && fallbackData) {
      return NextResponse.json({ posts: fallbackData });
    }

    // 3. Fallback to selecting standard columns from `posts`
    let basicQuery = supabase
      .from("posts")
      .select("id, city_slug, tag, title, body, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (city) basicQuery = basicQuery.eq("city_slug", city);

    const { data: basicData, error: basicError } = await basicQuery;
    if (!basicError && basicData) {
      return NextResponse.json({ posts: basicData.map((p) => ({ ...p, image_paths: [] })) });
    }

    console.error("All post queries failed:", postsError?.message, fallbackError?.message, basicError?.message);
    return NextResponse.json({ error: "Could not load posts from Supabase. Please try again." }, { status: 502 });
  } catch (error) {
    console.error("Supabase post list is unavailable:", error);
    return NextResponse.json({ error: "Supabase is not available. Check server configuration and try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  // 1. Rate limiting on post creation
  const rateLimitResponse = enforceRateLimit(request, "posts");
  if (rateLimitResponse) return rateLimitResponse;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const parsed = postCreateRequestSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();

    const insertPayload: Record<string, unknown> = {
      city_slug: parsed.data.post.city,
      tag: parsed.data.post.tag,
      title: parsed.data.post.title,
      body: parsed.data.post.body,
      image_paths: parsed.data.imagePaths,
      author_id: parsed.data.anonId,
      anon_id: parsed.data.anonId,
      author_name: parsed.data.authorName,
    };

    let { data, error } = await supabase
      .from("posts")
      .insert(insertPayload)
      .select("id, city_slug, author_id, anon_id, tag, title, body, image_paths, created_at, updated_at")
      .single();

    // If anon_id column does not exist, retry without it
    if (error && error.message.includes("anon_id")) {
      delete insertPayload.anon_id;
      delete insertPayload.author_name;
      const retryResult = await supabase
        .from("posts")
        .insert(insertPayload)
        .select("id, city_slug, author_id, tag, title, body, created_at, updated_at")
        .single();
      data = retryResult.data ? { ...retryResult.data, anon_id: parsed.data.anonId, author_name: parsed.data.authorName, image_paths: parsed.data.imagePaths } : null;
      error = retryResult.error;
    }

    if (error) {
      console.error("Supabase post create failed:", error.message);
      return NextResponse.json({ error: error.message || "Could not publish your post. Please check Supabase permissions." }, { status: 502 });
    }
    return NextResponse.json({ post: { ...data, mine: true } }, { status: 201 });
  } catch (error) {
    console.error("Supabase post create is unavailable:", error);
    return NextResponse.json({ error: "Supabase is not available. Check server configuration and try again." }, { status: 503 });
  }
}
