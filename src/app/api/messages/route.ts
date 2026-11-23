import { NextResponse } from "next/server";
import { z } from "zod";
import { messageDraftSchema } from "@/features/posts/schema";
import { readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit } from "@/lib/rate-limit";
import { loadAreaScope } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_REQUEST_BYTES = 16 * 1024;

type MessageRow = {
  id: string;
  client_id: string | null;
  body: string;
  author_id: string;
  author_handle: string | null;
  created_at: string;
  deleted_at: string | null;
};

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    const currentUserId = userResult?.user?.id ?? null;
    if (!userResult?.user) {
      return NextResponse.json({ error: "Sign in to load messages.", code: "auth_required" }, { status: 401 });
    }

    // General chat is city-scoped: messages live in the viewer's city area.
    const areaResult = await loadAreaScope(supabase, userResult.user.id, "city");
    if (!areaResult.ok) return areaResult.response;
    const { areaId } = areaResult.context;

    // Take the newest 50, then flip back to chronological order for display.
    const { data, error } = await supabase
      .from("messages")
      .select("id, client_id, body, author_id, author_handle, created_at, deleted_at")
      .eq("area_id", areaId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Supabase area message list failed:", error.message);
      return NextResponse.json({ error: "Could not load messages. Please try again." }, { status: 502 });
    }

    const rows = ((data ?? []) as MessageRow[]).slice().reverse();
    const messages = rows.map((row: MessageRow) => {
      const isMine = row.author_id === currentUserId;
      const authorName = (row.author_handle ?? "").trim() || "Community member";
      return {
        id: row.id,
        body: row.deleted_at ? "" : row.body,
        time: new Date(row.created_at).toLocaleString(),
        fromYou: isMine,
        author: isMine ? "You" : authorName,
        author_username: row.author_handle ?? null,
        initials: isMine ? "YO" : authorName.slice(0, 2).toUpperCase(),
        anon_id: row.client_id ?? "",
      };
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Supabase message list is unavailable:", error);
    return NextResponse.json({ error: "Supabase is not available. Check server configuration and try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status });

  const schema = z.object({
    city: z.string().min(1),
    channel: z.string().min(1),
    body: messageDraftSchema.shape.body,
    // Per-message id used for idempotent retries. Must be unique per message,
    // never a stable device id, or the unique (author_id, client_id) index
    // would collapse every message into the first one.
    clientId: z.string().min(1).max(120).optional(),
    anonId: z.string().max(120).optional(),
    authorName: z.string().max(80).optional(),
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
    if (!userResult?.user) return NextResponse.json({ error: "Sign in to send a message.", code: "auth_required" }, { status: 401 });
    const rateLimitResponse = await enforceRateLimit(supabase, "messages");
    if (rateLimitResponse) return rateLimitResponse;

    // General chat is city-scoped: the insert must use the area-scoped columns
    // granted to authenticated, with the viewer's own area on record.
    const areaResult = await loadAreaScope(supabase, userResult.user.id, "city");
    if (!areaResult.ok) return areaResult.response;
    const { areaId, h3Cell } = areaResult.context;

    const clientId = parsed.data.clientId ?? crypto.randomUUID();
    const { data, error } = await supabase
      .from("messages")
      .insert({
        area_id: areaId,
        scope: "city",
        h3_cell: h3Cell,
        client_id: clientId,
        author_id: userResult.user.id,
        author_handle: parsed.data.authorName?.trim().slice(0, 40) || "Ghost",
        body: parsed.data.body,
      })
      .select("id, client_id, body, author_id, author_handle, created_at, deleted_at")
      .single();

    if (error || !data) {
      const errorCode = (error as { code?: string } | null)?.code;
      // A retried send can hit the unique (author_id, client_id) index. Return
      // the existing row instead of creating a duplicate.
      if (errorCode === "23505") {
        const { data: existing } = await supabase
          .from("messages")
          .select("id, client_id, body, author_id, author_handle, created_at, deleted_at")
          .eq("author_id", userResult.user.id)
          .eq("client_id", clientId)
          .maybeSingle();

        if (existing) {
          const existingRow = existing as MessageRow;
          return NextResponse.json({
            message: {
              id: existingRow.id,
              body: existingRow.body,
              time: new Date(existingRow.created_at).toLocaleString(),
              fromYou: true,
              author: "You",
              author_username: null,
              initials: "YO",
            },
          }, { status: 200 });
        }
      }

      console.error("Supabase message create failed:", error?.message);
      return NextResponse.json({ error: error?.message || "Could not send your message." }, { status: 502 });
    }

    const created = data as MessageRow;
    return NextResponse.json({
      message: {
        id: created.id,
        body: created.body,
        time: new Date(created.created_at).toLocaleString(),
        fromYou: true,
        author: "You",
        author_username: null,
        initials: "YO",
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Message send is unavailable:", error);
    return NextResponse.json({ error: "Could not send your message. Please try again." }, { status: 503 });
  }
}
