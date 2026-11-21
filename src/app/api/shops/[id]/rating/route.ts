import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SHOP_RATING_MAX,
  SHOP_RATING_MIN,
  summarizeShopRatings,
  type ShopRatingRow,
} from "@/features/shops/reviews";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_REQUEST_BYTES = 2 * 1024;
const uuidSchema = z.string().uuid();

const ratingBodySchema = z
  .object({
    rating: z.number().int().min(SHOP_RATING_MIN).max(SHOP_RATING_MAX),
  })
  .strict();

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getShopId(context: RouteContext) {
  const { id } = await context.params;
  return uuidSchema.safeParse(id);
}

async function loadSummary(supabase: SupabaseClient, shopId: string, userId: string) {
  const { data, error } = await supabase
    .from("shop_ratings")
    .select("rating, user_id")
    .eq("shop_id", shopId);

  if (error) {
    console.error("Shop rating summary failed:", error.message);
    return null;
  }

  return summarizeShopRatings((data ?? []) as ShopRatingRow[], userId, shopId);
}

export async function GET(_request: Request, context: RouteContext) {
  const id = await getShopId(context);
  if (!id.success) {
    return NextResponse.json({ error: "Invalid shop ID.", code: "invalid_request" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to see shop ratings.", code: "auth_required" },
        { status: 401 },
      );
    }

    const summary = await loadSummary(supabase, id.data, userResult.user.id);
    if (!summary) {
      return NextResponse.json(
        { error: "Could not load ratings.", code: "server_error" },
        { status: 502 },
      );
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Shop rating load failed:", error);
    return NextResponse.json(
      { error: "Could not load ratings.", code: "server_error" },
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

  const parsed = ratingBodySchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Give a whole number of stars between ${SHOP_RATING_MIN} and ${SHOP_RATING_MAX}.`,
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to rate a shop.", code: "auth_required" },
        { status: 401 },
      );
    }

    const rateLimitResponse = await enforceRateLimit(supabase, "shopRating", id.data);
    if (rateLimitResponse) return rateLimitResponse;

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id")
      .eq("id", id.data)
      .maybeSingle();

    if (shopError) {
      console.error("Shop rating shop lookup failed:", shopError.message);
      return NextResponse.json(
        { error: "Could not save your rating. Please try again.", code: "server_error" },
        { status: 502 },
      );
    }
    if (!shop) {
      return NextResponse.json({ error: "That shop was not found.", code: "not_found" }, { status: 404 });
    }

    const { error } = await supabase.from("shop_ratings").upsert(
      {
        shop_id: id.data,
        user_id: userResult.user.id,
        rating: parsed.data.rating,
      },
      { onConflict: "shop_id,user_id" },
    );

    if (error) {
      console.error("Shop rating save failed:", error.message);
      return NextResponse.json(
        { error: "Could not save your rating. Please try again.", code: "server_error" },
        { status: 502 },
      );
    }

    const summary = await loadSummary(supabase, id.data, userResult.user.id);
    if (!summary) {
      return NextResponse.json(
        { error: "Rating saved, but the summary could not load.", code: "server_error" },
        { status: 502 },
      );
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Shop rating save failed:", error);
    return NextResponse.json(
      { error: "Could not save your rating. Please try again.", code: "server_error" },
      { status: 503 },
    );
  }
}
