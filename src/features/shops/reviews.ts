import { hasBlockedLanguage } from "@/features/area/chat";
import { ghostHandle, type HandleProfile } from "@/features/area/handle";

export const SHOP_RATING_MIN = 1;
export const SHOP_RATING_MAX = 5;

export const MAX_SHOP_REVIEW_LENGTH = 300;
export const SHOP_REVIEW_PAGE_SIZE = 10;

export type ShopRatingRow = {
  rating: number;
  user_id: string;
};

export type ShopRatingSummary = {
  shopId: string;
  average: number | null;
  count: number;
  myRating: number | null;
};

export type ShopReview = {
  id: string;
  handle: string;
  rating: number | null;
  body: string;
  createdAt: string;
  edited: boolean;
  isMine: boolean;
};

export type ShopReviewsPage = {
  shopId: string;
  reviews: ShopReview[];
  nextCursor: string | null;
};

export type ShopReviewCheck =
  | { ok: true; body: string }
  | {
      ok: false;
      reason: "empty" | "too_long" | "blocked_language";
      message: string;
    };

export function summarizeShopRatings(
  rows: ShopRatingRow[],
  userId: string,
  shopId: string,
): ShopRatingSummary {
  const valid = rows.filter(
    (row) =>
      Number.isInteger(row.rating) && row.rating >= SHOP_RATING_MIN && row.rating <= SHOP_RATING_MAX,
  );

  if (valid.length === 0) {
    return { shopId, average: null, count: 0, myRating: null };
  }

  const total = valid.reduce((sum, row) => sum + row.rating, 0);
  const average = Math.round((total / valid.length) * 10) / 10;
  const mine = valid.find((row) => row.user_id === userId);

  return {
    shopId,
    average,
    count: valid.length,
    myRating: mine ? mine.rating : null,
  };
}

export function inspectShopReview(raw: string): ShopReviewCheck {
  const body = raw.trim();

  if (!body) {
    return { ok: false, reason: "empty", message: "Write a review before posting." };
  }
  if (body.length > MAX_SHOP_REVIEW_LENGTH) {
    return {
      ok: false,
      reason: "too_long",
      message: `Reviews can be up to ${MAX_SHOP_REVIEW_LENGTH} characters.`,
    };
  }
  if (hasBlockedLanguage(body)) {
    return {
      ok: false,
      reason: "blocked_language",
      message: "That review contains language that is not allowed here.",
    };
  }

  return { ok: true, body };
}

export function displayShopReviewHandle(profile: HandleProfile) {
  return ghostHandle(profile);
}