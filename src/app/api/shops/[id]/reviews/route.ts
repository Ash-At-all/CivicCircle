import { NextResponse } from "next/server";
import { z } from "zod";
import { decodeMessageCursor, encodeMessageCursor } from "@/features/area/chat";
import { ghostHandle } from "@/features/area/handle";
import {
  inspectShopReview,
  MAX_SHOP_REVIEW_LENGTH,
  SHOP_REVIEW_PAGE_SIZE,
  type ShopReview,
  type ShopReviewsPage,
} from "@/features/shops/reviews";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_REQUEST_BYTES = 2 * 1024;
const uuidSchema = z.string().uuid();

const reviewsQuerySchema = z
  .object({
    cursor: z.string().trim().max(200).optional(),
  })
  .strict();

const reviewBodySchema = z
  .object({
    body: z.string().max(2000),
  })
  .strict();

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

async function getShopId(context: RouteContext) {
  const { id } = await context.params;
  return uuidSchema.safeParse(id);
}

async function ensureShopExists(supabase: SupabaseClient, shopId: string) {
  const { data, error } = await supabase.from("shops").select("id").eq("id", shopId).maybeSingle();
  if (error) return { ok: false as const, status: 502, error: "Could not load reviews." };
  if (!data) return { ok: false as const, status: 404, error: "That shop was not found." };
  return { ok: true as const };
}

function mapReview(
  row: ReviewRow,
  handle: string,
  rating: number | null,
  isMine: boolean,
): ShopReview {
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
    console.error("Shop review handles failed:", error.message);
    return handles;
  }
  for (const profile of (data ?? []) as ProfileRow[]) {
    handles.set(profile.id, ghostHandle(profile));
  }
  return handles;
}

async function loadRatings(supabase: SupabaseClient, shopId: string, userIds: string[]) {
  const ratings = new Map<string, number>();
  if (userIds.length === 0) return ratings;
  const { data, error } = await supabase
    .from("shop_ratings")
    .select("user_id, rating")
    .eq("shop_id", shopId)
    .in("user_id", userIds);
  if (error) {
    console.error("Shop review ratings failed:", error.message);
    return ratings;
  }
  for (const row of (data ?? []) as { user_id: string; rating: number }[]) {
    ratings.set(row.user_id, row.rating);
  }
  return ratings;
}

export async function GET(request: Request, context: RouteContext) {
  const id = await getShopId(context);
  if (!id.success) {
    return NextResponse.json({ error: "Invalid shop ID.", code: "invalid_request" }, { status: 400 });
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedQuery = reviewsQuerySchema.safeParse({
      cursor: searchParams.get("cursor") ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "That review cursor is not valid.", code: "invalid_request" },
        { status: 400 },
      );
    }

    const cursor = parsedQuery.data.cursor ? decodeMessageCursor(parsedQuery.data.cursor) : null;
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
        { error: "Sign in to read shop reviews.", code: "auth_required" },
        { status: 401 },
      );
    }

    const exists = await ensureShopExists(supabase, id.data);
    if (!exists.ok) {
      return NextResponse.json({ error: exists.error, code: "not_found" }, { status: exists.status });
    }

    let reviewsQuery = supabase
      .from("shop_reviews")
      .select("id, user_id, body, created_at, updated_at")
      .eq("shop_id", id.data)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(SHOP_REVIEW_PAGE_SIZE);

    if (cursor) {
      reviewsQuery = reviewsQuery.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      );
    }

    const { data, error } = await reviewsQuery;
    if (error) {
      console.error("Shop reviews load failed:", error.message);
      return NextResponse.json(
        { error: "Could not load reviews.", code: "server_error" },
        { status: 502 },
      );
    }

    const rows = (data ?? []) as ReviewRow[];
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const [handles, ratings] = await Promise.all([
      loadHandles(supabase, userIds),
      loadRatings(supabase, id.data, userIds),
    ]);

    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === SHOP_REVIEW_PAGE_SIZE && last
        ? encodeMessageCursor(last.created_at, last.id)
        : null;

    const response: ShopReviewsPage = {
      shopId: id.data,
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
    console.error("Shop reviews load failed:", error);
    return NextResponse.json(
      { error: "Could not load reviews.", code: "server_error" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const id = await getShopId(context);
  if (!id.success) {
    return NextResponse.json({ error: "Invalid shop ID.", code: "invalid_request" }, { status: 400 });
  }

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
        error: `Reviews can be up to ${MAX_SHOP_REVIEW_LENGTH} characters.`,
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  const checked = inspectShopReview(parsed.data.body);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.message, code: checked.reason }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to review a shop.", code: "auth_required" },
        { status: 401 },
      );
    }

    const exists = await ensureShopExists(supabase, id.data);
    if (!exists.ok) {
      return NextResponse.json({ error: exists.error, code: "not_found" }, { status: exists.status });
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "shopReview", id.data);
    if (rateLimitResponse) return rateLimitResponse;

    const { data, error } = await supabase
      .from("shop_reviews")
      .upsert(
        {
          shop_id: id.data,
          user_id: userResult.user.id,
          body: checked.body,
        },
        { onConflict: "shop_id,user_id" },
      )
      .select("id, user_id, body, created_at, updated_at")
      .single();

    if (error || !data) {
      console.error("Shop review save failed:", error?.message);
      return NextResponse.json(
        { error: "Could not save your review. Please try again.", code: "server_error" },
        { status: 502 },
      );
    }

    const row = data as ReviewRow;
    const [profileResult, ratingResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("id", userResult.user.id)
        .maybeSingle(),
      supabase
        .from("shop_ratings")
        .select("rating")
        .eq("shop_id", id.data)
        .eq("user_id", userResult.user.id)
        .maybeSingle(),
    ]);

    const handle = ghostHandle((profileResult.data as ProfileRow | null) ?? null);
    const rating = (ratingResult.data as { rating: number } | null)?.rating ?? null;

    return NextResponse.json({ review: mapReview(row, handle, rating, true) });
  } catch (error) {
    console.error("Shop review save failed:", error);
    return NextResponse.json(
      { error: "Could not save your review. Please try again.", code: "server_error" },
      { status: 503 },
    );
  }
}
