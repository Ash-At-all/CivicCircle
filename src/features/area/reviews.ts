import { hasBlockedLanguage, type AreaScope } from "./chat";

export const MAX_AREA_REVIEW_LENGTH = 500;
export const AREA_REVIEW_PAGE_SIZE = 20;

export type AreaReview = {
  id: string;
  handle: string;
  rating: number | null;
  body: string;
  createdAt: string;
  edited: boolean;
  isMine: boolean;
};

export type AreaReviewsPage = {
  scope: AreaScope;
  areaId: string;
  reviews: AreaReview[];
  nextCursor: string | null;
};

export type AreaReviewCheck =
  | { ok: true; body: string }
  | {
      ok: false;
      reason: "empty" | "too_long" | "blocked_language";
      message: string;
    };

export function inspectAreaReview(raw: string): AreaReviewCheck {
  const body = raw.trim();

  if (!body) {
    return { ok: false, reason: "empty", message: "Write a review before posting." };
  }
  if (body.length > MAX_AREA_REVIEW_LENGTH) {
    return {
      ok: false,
      reason: "too_long",
      message: `Reviews can be up to ${MAX_AREA_REVIEW_LENGTH} characters.`,
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
