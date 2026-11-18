import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AREA_SCOPES,
  encodeMessageCursor,
  decodeMessageCursor,
  inspectAreaMessage,
  type AreaChatMessage,
  type AreaMessagesPage,
  type AreaScope,
} from "@/features/area/chat";
import { ghostHandle } from "@/features/area/handle";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { loadAreaScope } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  AREA_PHOTO_BUCKET,
  AREA_PHOTO_MAX_BYTES,
  AreaPhotoTooLargeError,
  AreaPhotoUnsupportedError,
  convertAreaPhotoToWebp,
  isAreaPhotoMime,
  removeAreaPhoto,
  signAreaPhotoUrls,
} from "@/lib/server/area-photo";

const PAGE_SIZE = 50;
const MAX_JSON_REQUEST_BYTES = 4 * 1024;
const MAX_MULTIPART_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_BYTES = AREA_PHOTO_MAX_BYTES;

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
  photo_path: string | null;
};

type ProfileRow = {
  username: string | null;
  display_name: string | null;
};

function mapMessage(row: MessageRow, photoUrl: string | null): AreaChatMessage {
  return {
    id: row.id,
    clientId: row.client_id,
    body: row.deleted_at ? "" : row.body,
    authorId: row.author_id,
    authorHandle: row.author_handle?.trim() || "Ghost",
    createdAt: row.created_at,
    deleted: Boolean(row.deleted_at),
    photoUrl: row.deleted_at ? null : photoUrl,
  };
}

const MESSAGE_COLUMNS =
  "id, client_id, body, author_id, author_handle, created_at, deleted_at, photo_path";

class MultipartTooLargeError extends Error {}

/**
 * Buffered multipart read so an oversized upload is rejected before the whole
 * body is parsed in memory.
 */
async function readMultipartForm(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_MULTIPART_REQUEST_BYTES) {
    throw new MultipartTooLargeError("multipart request too large");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new TypeError("empty body");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_MULTIPART_REQUEST_BYTES) {
        await reader.cancel();
        throw new MultipartTooLargeError("multipart request too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const bufferedRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body,
  });
  return bufferedRequest.formData();
}

type PostInput =
  | {
      ok: true;
      scope: AreaScope;
      body: string;
      clientId: string;
      photo: File | null;
    }
  | { ok: false; response: Response };

function invalid(error: string, status = 400, code = "invalid_request") {
  return { ok: false as const, response: NextResponse.json({ error, code }, { status }) };
}

async function parseMultipartInput(request: Request): Promise<PostInput> {
  let formData: FormData;
  try {
    formData = await readMultipartForm(request);
  } catch (error) {
    if (error instanceof MultipartTooLargeError) {
      return invalid("That photo is too large. Use an image under 5 MB.", 413, "photo_too_large");
    }
    if (error instanceof TypeError) {
      return invalid("Could not read the upload. Please try again.");
    }
    throw error;
  }

  const scopeRaw = formData.get("scope");
  const bodyRaw = formData.get("body");
  const clientIdRaw = formData.get("clientId");
  const photos = formData.getAll("photo");

  if (typeof scopeRaw !== "string" || !AREA_SCOPES.includes(scopeRaw as AreaScope)) {
    return invalid("Choose a valid room.");
  }
  if (typeof clientIdRaw !== "string" || !z.string().uuid().safeParse(clientIdRaw).success) {
    return invalid("That message reference is not valid.");
  }
  if (bodyRaw !== null && typeof bodyRaw !== "string") {
    return invalid("Write a valid message before sending.");
  }
  if (photos.length > 1) {
    return invalid("Attach one photo per message.");
  }

  const photo = photos[0];
  if (photo !== undefined && !(photo instanceof File)) {
    return invalid("That photo could not be read. Please try again.");
  }
  if (photo && photo.size <= 0) {
    return invalid("That photo is empty. Choose another image.");
  }

  return {
    ok: true,
    scope: scopeRaw as AreaScope,
    body: typeof bodyRaw === "string" ? bodyRaw : "",
    clientId: clientIdRaw,
    photo: photo ?? null,
  };
}

async function parsePostInput(request: Request): Promise<PostInput> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    return parseMultipartInput(request);
  }

  const payload = await readJsonBody(request, MAX_JSON_REQUEST_BYTES);
  if (!payload.ok) {
    return invalid(payload.error, payload.status);
  }

  const parsed = sendMessageSchema.safeParse(payload.value);
  if (!parsed.success) {
    return invalid("Write a valid message before sending.");
  }

  return {
    ok: true,
    scope: parsed.data.scope,
    body: parsed.data.body,
    clientId: parsed.data.clientId,
    photo: null,
  };
}

type PreparedPhoto =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; response: Response };

async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Photos must be 5 MB or smaller.", code: "photo_too_large" },
        { status: 413 },
      ),
    };
  }
  if (!isAreaPhotoMime(file.type)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Choose a JPEG, PNG, or WebP image.", code: "unsupported_photo" },
        { status: 415 },
      ),
    };
  }

  try {
    const bytes = await convertAreaPhotoToWebp(new Uint8Array(await file.arrayBuffer()), file.type);
    return { ok: true, bytes };
  } catch (error) {
    if (error instanceof AreaPhotoTooLargeError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "That photo could not be compressed under 5 MB.", code: "photo_too_large" },
          { status: 413 },
        ),
      };
    }
    if (error instanceof AreaPhotoUnsupportedError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "That file is not a readable image.", code: "unsupported_photo" },
          { status: 415 },
        ),
      };
    }
    throw error;
  }
}

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

    const photoPaths = page
      .filter((row) => !row.deleted_at && row.photo_path)
      .map((row) => row.photo_path as string);
    const signedUrls = await signAreaPhotoUrls(supabase, photoPaths);

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
      messages: page.map((row) =>
        mapMessage(row, row.photo_path ? signedUrls.get(row.photo_path) ?? null : null),
      ),
      nextCursor,
      roomCount: Number(countRow?.active_people ?? 0),
      muted,
      viewer: profile
        ? { id: userResult.user.id, handle: ghostHandle(profile) }
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

  // Tracks an uploaded object that has no message row yet, so unexpected
  // failures cannot leave an orphan in storage.
  let orphanPhoto: { supabase: SupabaseClient; path: string } | null = null;

  try {
    // Authenticate before reading or decoding the upload so anonymous callers
    // cannot spend image-processing work.
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to send area messages.", code: "auth_required" },
        { status: 401 },
      );
    }

    const input = await parsePostInput(request);
    if (!input.ok) return input.response;

    const checked = inspectAreaMessage(input.body, {
      allowEmpty: Boolean(input.photo),
    });
    if (!checked.ok) {
      return NextResponse.json(
        { error: checked.message, code: checked.reason },
        { status: 400 },
      );
    }

    const areaResult = await loadAreaScope(supabase, userResult.user.id, input.scope);
    if (!areaResult.ok) return areaResult.response;
    const { areaId, h3Cell } = areaResult.context;

    const rateLimitResponse = await enforceRateLimit(supabase, "areaMessageSend", areaId);
    if (rateLimitResponse) return rateLimitResponse;

    let photo: PreparedPhoto | null = null;
    if (input.photo) {
      photo = await preparePhoto(input.photo);
      if (!photo.ok) return photo.response;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", userResult.user.id)
      .maybeSingle();
    const authorHandle = ghostHandle((profileData as ProfileRow | null) ?? null);

    const photoPath = photo
      ? `${userResult.user.id}/${areaId}/${crypto.randomUUID()}.webp`
      : null;

    if (photoPath && photo) {
      const { error: uploadError } = await supabase.storage
        .from(AREA_PHOTO_BUCKET)
        .upload(photoPath, photo.bytes, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        const forbidden = /row-level security|policy/i.test(uploadError.message);
        console.error("Area photo upload failed:", uploadError.message);
        return NextResponse.json(
          {
            error: forbidden
              ? "You can only upload photos for your own area."
              : "Could not upload that photo. Please try again.",
            code: forbidden ? "forbidden" : "photo_upload_failed",
          },
          { status: forbidden ? 403 : 502 },
        );
      }

      orphanPhoto = { supabase, path: photoPath };
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        area_id: areaId,
        scope: input.scope,
        h3_cell: h3Cell,
        client_id: input.clientId,
        author_id: userResult.user.id,
        author_handle: authorHandle,
        body: checked.body,
        photo_path: photoPath,
      })
      .select(MESSAGE_COLUMNS)
      .single();

    if (error) {
      // Never leave an uploaded object behind when the row is not written.
      if (photoPath) {
        await removeAreaPhoto(supabase, photoPath);
        orphanPhoto = null;
      }

      const errorCode = (error as { code?: string }).code;

      // A retried send can hit unique (author_id, client_id). Return the row
      // that already exists instead of creating a duplicate.
      if (errorCode === "23505") {
        const { data: existing } = await supabase
          .from("messages")
          .select(MESSAGE_COLUMNS)
          .eq("author_id", userResult.user.id)
          .eq("client_id", input.clientId)
          .maybeSingle();

        if (existing) {
          const existingRow = existing as MessageRow;
          const signed = existingRow.photo_path
            ? await signAreaPhotoUrls(supabase, [existingRow.photo_path])
            : new Map<string, string>();
          return NextResponse.json(
            {
              message: mapMessage(
                existingRow,
                existingRow.photo_path ? signed.get(existingRow.photo_path) ?? null : null,
              ),
            },
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

    const row = data as MessageRow;
    orphanPhoto = null;
    const signed = row.photo_path
      ? await signAreaPhotoUrls(supabase, [row.photo_path])
      : new Map<string, string>();

    return NextResponse.json(
      {
        message: mapMessage(row, row.photo_path ? signed.get(row.photo_path) ?? null : null),
      },
      { status: 201 },
    );
  } catch (error) {
    if (orphanPhoto) {
      try {
        await removeAreaPhoto(orphanPhoto.supabase, orphanPhoto.path);
      } catch (cleanupError) {
        console.error("Area photo cleanup failed:", cleanupError);
      }
    }
    console.error("Area message send failed:", error);
    return NextResponse.json(
      { error: "Could not send your message. Please try again.", code: "server_error" },
      { status: 503 },
    );
  }
}
