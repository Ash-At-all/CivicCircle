import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AREA_SCOPES,
  encodeMessageCursor,
  decodeMessageCursor,
  inspectAreaMessage,
  type AreaChatMessage,
  type AreaMessagesPage,
} from "@/features/area/chat";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { loadAreaScope } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;
const MAX_REQUEST_BYTES = 4 * 1024;

const messagesQuerySchema = z
  .object({
    scope: z.enum(AREA_SCOPES).default("locality"),
    cursor: z.string().trim().max(200).optional(),
  })
  .strict();

const sendMessageSchema = z
  .object({
    scope: z.enum(AREA_SCOPES),
    body: z.string().max(2000),
    clientId: z.string().uuid(),
  })
  .strict();

type MessageRow = {
  id: string;
  client_id: string | null;
  body: string;
  author_id: string;
  author_handle: string | null;
  created_at: string;
  deleted_at: string | null;
};

type ProfileRow = {
  username: string | null;
  display_name: string | null;
};

function handleFor(profile: ProfileRow | null) {
  const handle = profile?.display_name?.trim() || profile?.username?.trim() || "Ghost";
  return handle.slice(0, 40) || "Ghost";
}

function mapMessage(row: MessageRow): AreaChatMessage {
  return {
    id: row.id,
    clientId: row.client_id,
    body: row.deleted_at ? "" : row.body,
    authorId: row.author_id,
    authorHandle: row.author_handle?.trim() || "Ghost",
    createdAt: row.created_at,
    deleted: Boolean(row.deleted_at),
  };
}

const MESSAGE_COLUMNS =
  "id, client_id, body, author_id, author_handle, created_at, deleted_at";

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to load area chat.", code: "auth_required" },
        { status: 401 },
      );
    }

    const searchParams = new URL(request.url).searchParams;
    const parsedQuery = messagesQuerySchema.safeParse({
      scope: searchParams.get("scope") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Invalid room or cursor.", code: "invalid_request" },
        { status: 400 },
      );
    }

    const cursor = parsedQuery.data.cursor
      ? decodeMessageCursor(parsedQuery.data.cursor)
      : null;
    if (parsedQuery.data.cursor && !cursor) {
      return NextResponse.json(
        { error: "That message cursor is not valid.", code: "invalid_cursor" },
        { status: 400 },
      );
    }

    const areaResult = await loadAreaScope(
      supabase,
      userResult.user.id,
      parsedQuery.data.scope,
    );
    if (!areaResult.ok) return areaResult.response;
    const { areaId, areaIds } = areaResult.context;

    const rateLimitResponse = await enforceRateLimit(
      supabase,
      "areaMessagesRead",
      areaId,
    );
    if (rateLimitResponse) return rateLimitResponse;

    let messagesQuery = supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("area_id", areaId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);

    if (cursor) {
      messagesQuery = messagesQuery.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      );
    }

    const [messagesResult, countsResult, profileResult, mutesResult] =
      await Promise.all([
        messagesQuery,
        supabase.rpc("room_counts", {
          p_area_ids: [areaIds.locality, areaIds.ward, areaIds.city],
        }),
        supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", userResult.user.id)
          .maybeSingle(),
        supabase
          .from("area_mutes")
          .select("area_id")
          .eq("user_id", userResult.user.id)
          .in("area_id", [areaIds.locality, areaIds.ward, areaIds.city]),
      ]);

    if (messagesResult.error) {
      return NextResponse.json(
        { error: "Could not load messages.", code: "server_error" },
        { status: 502 },
      );
    }

    const newestFirst = (messagesResult.data ?? []) as MessageRow[];
    const page = [...newestFirst].reverse();
    const nextCursor =
      newestFirst.length === PAGE_SIZE && page[0]
        ? encodeMessageCursor(page[0].created_at, page[0].id)
        : null;

    const countRow = (countsResult.data ?? []).find(
      (row: { area_id: string }) => row.area_id === areaId,
    );
    const muted = (mutesResult.data ?? []).some(
      (row: { area_id: string }) => row.area_id === areaId,
    );
    const profile = (profileResult.data as ProfileRow | null) ?? null;

    const response: AreaMessagesPage = {
      scope: parsedQuery.data.scope,
      areaId,
      messages: page.map(mapMessage),
      nextCursor,
      roomCount: Number(countRow?.active_people ?? 0),
      muted,
      viewer: profile
        ? { id: userResult.user.id, handle: handleFor(profile) }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Area message load failed:", error);
    return NextResponse.json(
      { error: "Could not load messages.", code: "server_error" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const payload = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!payload.ok) {
    return NextResponse.json(
      { error: payload.error, code: "invalid_request" },
      { status: payload.status },
    );
  }

  const parsed = sendMessageSchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Write a valid message before sending.", code: "invalid_request" },
      { status: 400 },
    );
  }

  const checked = inspectAreaMessage(parsed.data.body);
  if (!checked.ok) {
    return NextResponse.json(
      { error: checked.message, code: checked.reason },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to send area messages.", code: "auth_required" },
        { status: 401 },
      );
    }

    const areaResult = await loadAreaScope(
      supabase,
      userResult.user.id,
      parsed.data.scope,
    );
    if (!areaResult.ok) return areaResult.response;
    const { areaId, h3Cell } = areaResult.context;

    const rateLimitResponse = await enforceRateLimit(
      supabase,
      "areaMessageSend",
      areaId,
    );
    if (rateLimitResponse) return rateLimitResponse;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", userResult.user.id)
      .maybeSingle();
    const authorHandle = handleFor((profileData as ProfileRow | null) ?? null);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        area_id: areaId,
        scope: parsed.data.scope,
        h3_cell: h3Cell,
        client_id: parsed.data.clientId,
        author_id: userResult.user.id,
        author_handle: authorHandle,
        body: checked.body,
      })
      .select(MESSAGE_COLUMNS)
      .single();

    if (error) {
      const errorCode = (error as { code?: string }).code;

      // Retrying after a timeout can hit the unique (author_id, client_id)
      // index. Return the row that already exists instead of a duplicate.
      if (errorCode === "23505") {
        const { data: existing } = await supabase
          .from("messages")
          .select(MESSAGE_COLUMNS)
          .eq("author_id", userResult.user.id)
          .eq("client_id", parsed.data.clientId)
          .maybeSingle();

        if (existing) {
          return NextResponse.json(
            { message: mapMessage(existing as MessageRow) },
            { status: 200 },
          );
        }
      }

      if (errorCode === "42501") {
        return NextResponse.json(
          { error: "You can only post in your own area rooms.", code: "forbidden" },
          { status: 403 },
        );
      }

      console.error("Area message insert failed:", error);
      return NextResponse.json(
        { error: "Could not send your message. Please try again.", code: "server_error" },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { message: mapMessage(data as MessageRow) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Area message send failed:", error);
    return NextResponse.json(
      { error: "Could not send your message. Please try again.", code: "server_error" },
      { status: 503 },
    );
  }
}
