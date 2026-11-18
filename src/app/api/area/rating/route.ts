import { NextResponse } from "next/server";
import { z } from "zod";
import { AREA_SCOPES, type AreaScope } from "@/features/area/chat";
import {
  AREA_RATING_MAX,
  AREA_RATING_MIN,
  summarizeAreaRatings,
  type AreaRatingRow,
} from "@/features/area/rating";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/server/origin";
import { readJsonBody } from "@/lib/server/json-body";
import { loadAreaScope } from "@/lib/server/area-scope";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_REQUEST_BYTES = 2 * 1024;

const ratingQuerySchema = z
  .object({
    scope: z.enum(AREA_SCOPES).default("locality"),
  })
  .strict();

const ratingBodySchema = z
  .object({
    scope: z.enum(AREA_SCOPES),
    rating: z.number().int().min(AREA_RATING_MIN).max(AREA_RATING_MAX),
  })
  .strict();

async function loadSummary(
  supabase: SupabaseClient,
  areaId: string,
  userId: string,
  scope: AreaScope,
) {
  const { data, error } = await supabase
    .from("area_ratings")
    .select("rating, user_id")
    .eq("area_id", areaId);

  if (error) {
    console.error("Area rating summary failed:", error.message);
    return null;
  }

  return summarizeAreaRatings((data ?? []) as AreaRatingRow[], userId, scope, areaId);
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedQuery = ratingQuerySchema.safeParse({
      scope: searchParams.get("scope") ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Choose a valid room.", code: "invalid_request" },
        { status: 400 },
      );
    }

    const supabase = await getSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult?.user) {
      return NextResponse.json(
        { error: "Sign in to see area ratings.", code: "auth_required" },
        { status: 401 },
      );
    }

    const areaResult = await loadAreaScope(supabase, userResult.user.id, parsedQuery.data.scope);
    if (!areaResult.ok) return areaResult.response;

    const summary = await loadSummary(
      supabase,
      areaResult.context.areaId,
      userResult.user.id,
      parsedQuery.data.scope,
    );
    if (!summary) {
      return NextResponse.json(
        { error: "Could not load ratings.", code: "server_error" },
        { status: 502 },
      );
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Area rating load failed:", error);
    return NextResponse.json(
      { error: "Could not load ratings.", code: "server_error" },
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

  const parsed = ratingBodySchema.safeParse(payload.value);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Give a whole number of stars between ${AREA_RATING_MIN} and ${AREA_RATING_MAX}.`,
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
        { error: "Sign in to rate an area.", code: "auth_required" },
        { status: 401 },
      );
    }

    const areaResult = await loadAreaScope(supabase, userResult.user.id, parsed.data.scope);
    if (!areaResult.ok) return areaResult.response;
    const { areaId } = areaResult.context;

    const rateLimitResponse = await enforceRateLimit(supabase, "areaRating");
    if (rateLimitResponse) return rateLimitResponse;

    const { error } = await supabase.rpc("set_area_rating", {
      p_area_id: areaId,
      p_rating: parsed.data.rating,
    });

    if (error) {
      const errorCode = (error as { code?: string }).code;
      if (errorCode === "42501") {
        return NextResponse.json(
          { error: "You can only rate as yourself.", code: "forbidden" },
          { status: 403 },
        );
      }
      if (errorCode === "23503") {
        return NextResponse.json(
          { error: "That area is not available.", code: "invalid_area" },
          { status: 400 },
        );
      }
      console.error("Area rating save failed:", error);
      return NextResponse.json(
        { error: "Could not save your rating. Please try again.", code: "server_error" },
        { status: 502 },
      );
    }

    const summary = await loadSummary(supabase, areaId, userResult.user.id, parsed.data.scope);
    if (!summary) {
      return NextResponse.json(
        { error: "Rating saved, but the summary could not load.", code: "server_error" },
        { status: 502 },
      );
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Area rating save failed:", error);
    return NextResponse.json(
      { error: "Could not save your rating. Please try again.", code: "server_error" },
      { status: 503 },
    );
  }
}
