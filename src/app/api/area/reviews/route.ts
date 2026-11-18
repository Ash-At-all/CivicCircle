import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AREA_SCOPES,
  decodeMessageCursor,
  encodeMessageCursor,
} from "@/features/area/chat";
import { ghostHandle } from "@/features/area/handle";
import {
  AREA_REVIEW_PAGE_SIZE,
  inspectAreaReview,
  MAX_AREA_REVIEW_LENGTH,
  type AreaReview,
  type AreaReviewsPage,
} from "@/features/area/reviews";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { loadAreaScope } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_REQUEST_BYTES = 2 * 1024;

const reviewsQuerySchema = z
  .object({
    scope: z.enum(AREA_SCOPES).default("locality"),
    cursor: z.string().trim().max(200).optional(),
  })
  .strict();

const reviewBodySchema = z
  .object({
    scope: z.enum(AREA_SCOPES),
    body: z.string().max(2000),
  })
  .strict();

type ReviewRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

function mapReview(
  row: ReviewRow,
  handle: string,
  rating: number | null,
  isMine: boolean,
): AreaReview {
  return {
    id: row.id,
    handle,
    rating,
    body: row.body,
    createdAt: row.created_at,
    edited: Date.parse(row.updated_at) > Date.parse(row.created_at),
    isMine,
  };
}

async function loadHandles(supabase: SupabaseClient, userIds: string[]) {
  const handles = new Map<string, string>();
  if (userIds.length === 0) return handles;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", userIds);

  if (error) {
    console.error("Area review handles failed:", error.message);
    return handles;
  }

  for (const profile of (data ?? []) as ProfileRow[]) {
    handles.set(profile.id, ghostHandle(profile));
  }
  return handles;
}

async function loadRatings(
  supabase: SupabaseClient,
  areaId: string,
  userIds: string[],
) {
  const ratings = new Map<string, number>();
  if (userIds.length === 0) return ratings;

  const { data, error } = await supabase
    .from("area_ratings")
    .select("user_id, rating")
    .eq("area_id", areaId)
    .in("user_id", userIds);

  if (error) {
    console.error("Area review ratings failed:", error.message);
    return ratings;
  }

  for (const row of (data ?? []) as { user_id: string; rating: number }[]) {
    ratings.set(row.user_id, row.rating);
  }
  return ratings;
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedQuery = reviewsQuerySchema.safeParse({
      scope: searchParams.get("scope") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Choose a valid room or cursor.", code: "invalid_request" },
        { status: 400 },
      );
    }

    const cursor = parsedQuery.data.cursor
      ? decodeMessageCursor(parsedQuery.data.cursor)
      : null;
    if (parsedQuery.data.cursor && !cursor) {
      return NextResponse.json(
        { error: "That review cursor is not valid.", code: "invalid_cursor" },
        { status: 400 },
      );
    }

    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to read area reviews.", code: "auth_required" },
        { status: 401 },
      );
    }

    const areaResult = await loadAreaScope(supabase, userResult.user.id, parsedQuery.data.scope);
    if (!areaResult.ok) return areaResult.response;
    const { areaId } = areaResult.context;

    let reviewsQuery = supabase
      .from("area_reviews")
      .select("id, user_id, body, created_at, updated_at")
      .eq("area_id", areaId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(AREA_REVIEW_PAGE_SIZE);

    if (cursor) {
      reviewsQuery = reviewsQuery.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      );
    }

    const { data, error } = await reviewsQuery;
    if (error) {
      console.error("Area reviews load failed:", error.message);
      return NextResponse.json(
        { error: "Could not load reviews.", code: "server_error" },
        { status: 502 },
      );
    }

    const rows = (data ?? []) as ReviewRow[];
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const [handles, ratings] = await Promise.all([
      loadHandles(supabase, userIds),
      loadRatings(supabase, areaId, userIds),
    ]);

    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === AREA_REVIEW_PAGE_SIZE && last
        ? encodeMessageCursor(last.created_at, last.id)
        : null;

    const response: AreaReviewsPage = {
      scope: parsedQuery.data.scope,
      areaId,
      reviews: rows.map((row) =>
        mapReview(
          row,
          handles.get(row.user_id) ?? "Ghost",
          ratings.get(row.user_id) ?? null,
          row.user_id === userResult.user.id,
        ),
      ),
      nextCursor,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Area reviews load failed:", error);
    return NextResponse.json(
      { error: "Could not load reviews.", code: "server_error" },
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

  const parsed = reviewBodySchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Reviews can be up to ${MAX_AREA_REVIEW_LENGTH} characters.`,
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  const checked = inspectAreaReview(parsed.data.body);
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
        { error: "Sign in to review an area.", code: "auth_required" },
        { status: 401 },
      );
    }

    const areaResult = await loadAreaScope(supabase, userResult.user.id, parsed.data.scope);
    if (!areaResult.ok) return areaResult.response;
    const { areaId } = areaResult.context;

    const rateLimitResponse = await enforceRateLimit(supabase, "areaReview");
    if (rateLimitResponse) return rateLimitResponse;

    const { data, error } = await supabase.rpc("set_area_review", {
      p_area_id: areaId,
      p_body: checked.body,
    });

    if (error) {
      const errorCode = (error as { code?: string }).code;
      if (errorCode === "42501") {
        return NextResponse.json(
          { error: "You can only review as yourself.", code: "forbidden" },
          { status: 403 },
        );
      }
      if (errorCode === "23503") {
        return NextResponse.json(
          { error: "That area is not available.", code: "invalid_area" },
          { status: 400 },
        );
      }
      console.error("Area review save failed:", error);
      return NextResponse.json(
        { error: "Could not save your review. Please try again.", code: "server_error" },
        { status: 502 },
      );
    }

    const row = (Array.isArray(data) ? data[0] : data) as ReviewRow | null;
    if (!row) {
      return NextResponse.json(
        { error: "Could not save your review. Please try again.", code: "server_error" },
        { status: 502 },
      );
    }
    const [profileResult, ratingResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", userResult.user.id)
        .maybeSingle(),
      supabase
        .from("area_ratings")
        .select("rating")
        .eq("area_id", areaId)
        .eq("user_id", userResult.user.id)
        .maybeSingle(),
    ]);

    const handle = ghostHandle((profileResult.data as ProfileRow | null) ?? null);
    const rating = (ratingResult.data as { rating: number } | null)?.rating ?? null;

    return NextResponse.json({ review: mapReview(row, handle, rating, true) });
  } catch (error) {
    console.error("Area review save failed:", error);
    return NextResponse.json(
      { error: "Could not save your review. Please try again.", code: "server_error" },
      { status: 503 },
    );
  }
}
