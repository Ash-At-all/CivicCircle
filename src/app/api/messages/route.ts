import { NextResponse } from "next/server";
import { z } from "zod";
import { messageDraftSchema } from "@/lib/post-schema";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 16 * 1024;

const listQuerySchema = z.object({
  city: z.string().min(1),
  channel: z.string().min(1),
  anon: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const city = url.searchParams.get("city");
  const channel = url.searchParams.get("channel");
  const anon = url.searchParams.get("anon");

  const parsed = listQuerySchema.safeParse({ city, channel, anon: anon ?? undefined });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();

    // 1. Try querying messages with anon_id
    const query = supabase
      .from("messages")
      .select("id, city_slug, channel_id, anon_id, body, created_at")
      .eq("city_slug", parsed.data.city)
      .eq("channel_id", parsed.data.channel)
      .order("created_at", { ascending: true })
      .limit(50);

    const { data, error } = await query;

    if (!error && data) {
      const messages = data.map((row) => ({
        id: row.id,
        body: row.body,
        time: new Date(row.created_at).toLocaleString(),
        fromYou: Boolean(parsed.data.anon && row.anon_id === parsed.data.anon),
        author: row.anon_id && row.anon_id === parsed.data.anon ? "You" : "Community member",
        author_username: null,
        initials: row.anon_id && row.anon_id === parsed.data.anon ? "YO" : "CM",
        anon_id: row.anon_id,
      }));
      return NextResponse.json({ messages });
    }

    // 2. If anon_id does not exist, fall back to basic columns
    console.warn("Direct anon_id message query failed, falling back to basic columns:", error?.message);
    const fallbackQuery = supabase
      .from("messages")
      .select("id, city_slug, channel_id, body, created_at")
      .eq("city_slug", parsed.data.city)
      .eq("channel_id", parsed.data.channel)
      .order("created_at", { ascending: true })
      .limit(50);

    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) {
      console.error("Supabase fallback message list failed:", fallbackError.message);
      return NextResponse.json({ error: "Could not load messages. Please try again." }, { status: 502 });
    }

    const messages = (fallbackData ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      time: new Date(row.created_at).toLocaleString(),
      fromYou: false,
      author: "Community member",
      author_username: null,
      initials: "CM",
      anon_id: null,
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Supabase message list is unavailable:", error);
    return NextResponse.json({ error: "Supabase is not available. Check server configuration and try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const rateLimitResponse = enforceRateLimit(request, "messages");
  if (rateLimitResponse) return rateLimitResponse;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const schema = z.object({
    city: z.string().min(1),
    channel: z.string().min(1),
    body: messageDraftSchema.shape.body,
    anonId: z.string().min(1),
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

    // Try inserting with anon_id first
    const insertPayload: Record<string, unknown> = {
      city_slug: parsed.data.city,
      channel_id: parsed.data.channel,
      body: parsed.data.body,
      anon_id: parsed.data.anonId,
    };

    let { data, error } = await supabase
      .from("messages")
      .insert(insertPayload)
      .select("id, city_slug, channel_id, anon_id, body, created_at")
      .single();

    // If anon_id column does not exist, retry without it
    if (error && error.message.includes("anon_id")) {
      delete insertPayload.anon_id;
      const retryResult = await supabase
        .from("messages")
        .insert(insertPayload)
        .select("id, city_slug, channel_id, body, created_at")
        .single();
      data = retryResult.data ? { ...retryResult.data, anon_id: parsed.data.anonId } : null;
      error = retryResult.error;
    }

    if (error || !data) {
      console.error("Supabase message create failed:", error?.message);
      return NextResponse.json({ error: error?.message || "Could not send your message. Please check Supabase permissions." }, { status: 502 });
    }

    return NextResponse.json({
      message: {
        id: data.id,
        body: data.body,
        time: new Date(data.created_at).toLocaleString(),
        fromYou: true,
        author: "You",
        author_username: null,
        initials: "YO",
        anon_id: data.anon_id,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Message send is unavailable:", error);
    return NextResponse.json({ error: "Supabase is not available. Check server configuration and try again." }, { status: 503 });
  }
}
