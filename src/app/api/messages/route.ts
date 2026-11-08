import { NextResponse } from "next/server";
import { z } from "zod";
import { messageDraftSchema } from "@/lib/post-schema";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MESSAGE_COLUMNS = "id, city_slug, channel_id, anon_id, body, created_at";
const MAX_REQUEST_BYTES = 16 * 1024;

const listQuerySchema = z.object({
  city: z.string().min(1),
  channel: z.string().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const city = url.searchParams.get("city");
  const channel = url.searchParams.get("channel");

  const parsed = listQuerySchema.safeParse({ city, channel });
  if (!parsed.success) {
    return NextResponse.json({ error: "City and channel are required." }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("city_slug", parsed.data.city)
      .eq("channel_id", parsed.data.channel)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Supabase message list failed:", error.message);
      return NextResponse.json({ error: "Could not load messages. Please try again." }, { status: 502 });
    }

    const messages = (data ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      time: new Date(row.created_at).toLocaleString(),
      fromYou: false,
      anon_id: row.anon_id,
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Message list is unavailable:", error);
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

    const { data, error } = await supabase
      .from("messages")
      .insert({
        city_slug: parsed.data.city,
        channel_id: parsed.data.channel,
        body: parsed.data.body,
        anon_id: parsed.data.anonId,
      })
      .select(MESSAGE_COLUMNS)
      .single();

    if (error) {
      console.error("Supabase message create failed:", error.message);
      return NextResponse.json({ error: "Could not send your message. Please try again." }, { status: 502 });
    }

    return NextResponse.json({
      message: {
        id: data.id,
        body: data.body,
        time: new Date(data.created_at).toLocaleString(),
        fromYou: true,
        anon_id: data.anon_id,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Message send is unavailable:", error);
    return NextResponse.json({ error: "Supabase is not available. Check server configuration and try again." }, { status: 503 });
  }
}
