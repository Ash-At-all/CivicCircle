import { NextResponse } from "next/server";
import { citySlugSchema, postCreateRequestSchema } from "@/lib/post-schema";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const PUBLIC_POST_COLUMNS = "id, city_slug, anon_id, tag, title, body, image_paths, created_at, updated_at";
const MAX_REQUEST_BYTES = 16 * 1024;

function isMissingImagePathsColumn(message: string) {
  return message.toLowerCase().includes("image_paths")
    && (message.toLowerCase().includes("schema cache") || message.toLowerCase().includes("does not exist"));
}

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get("city");
  const author = new URL(request.url).searchParams.get("author");
  if (city) {
    const parsedCity = citySlugSchema.safeParse(city);
    if (!parsedCity.success) {
      return NextResponse.json({ error: "Choose a valid city." }, { status: 400 });
    }
  }

  try {
    const supabase = await getSupabaseServerClient();

    let query = supabase
      .from("posts")
      .select(PUBLIC_POST_COLUMNS)
      .order("created_at", { ascending: false });
    if (city) query = query.eq("city_slug", city);
    if (author) query = query.eq("anon_id", author);
    const { data, error } = await query;
    if (error) {
      console.error("Supabase post list failed:", error.message);
      if (isMissingImagePathsColumn(error.message)) {
        return NextResponse.json(
          { error: "The post image database migration is missing. Run the image_paths SQL migration in Supabase SQL Editor, then retry." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "Could not load posts from Supabase. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ posts: data ?? [] });
  } catch (error) {
    console.error("Supabase post list is unavailable:", error);
    return NextResponse.json({ error: "Supabase is not available. Check server configuration and try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
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

  const anonId = (payload.value as { anonId?: string }).anonId;
  if (!anonId) {
    return NextResponse.json({ error: "Anonymous ID is required." }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase
      .from("posts")
      .insert({
        city_slug: parsed.data.post.city,
        tag: parsed.data.post.tag,
        title: parsed.data.post.title,
        body: parsed.data.post.body,
        image_paths: parsed.data.imagePaths,
        anon_id: anonId,
      })
      .select(PUBLIC_POST_COLUMNS)
      .single();

    if (error) {
      console.error("Supabase post create failed:", error.message);
      if (isMissingImagePathsColumn(error.message)) {
        return NextResponse.json(
          { error: "The post image database migration is missing. Run the image_paths SQL migration in Supabase SQL Editor, then retry." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "Could not publish your post. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ post: { ...data, mine: true } }, { status: 201 });
  } catch (error) {
    console.error("Supabase post create is unavailable:", error);
    return NextResponse.json({ error: "Supabase is not available. Check server configuration and try again." }, { status: 503 });
  }
}
