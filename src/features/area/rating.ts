import type { AreaScope } from "./chat";

export const AREA_RATING_MIN = 1;
export const AREA_RATING_MAX = 5;

export type AreaRatingRow = {
  rating: number;
  user_id: string;
};

export type AreaRatingSummary = {
  scope: AreaScope;
  areaId: string;
  average: number | null;
  count: number;
  myRating: number | null;
};

/**
 * Real ratings only. With no rows the average stays null so the UI can show
 * an honest empty state instead of a placeholder score.
 */
export function summarizeAreaRatings(
  rows: AreaRatingRow[],
  userId: string,
  scope: AreaScope,
  areaId: string,
): AreaRatingSummary {
  const valid = rows.filter(
    (row) => Number.isInteger(row.rating) && row.rating >= AREA_RATING_MIN && row.rating <= AREA_RATING_MAX,
  );

  if (valid.length === 0) {
    return { scope, areaId, average: null, count: 0, myRating: null };
  }

  const total = valid.reduce((sum, row) => sum + row.rating, 0);
  const average = Math.round((total / valid.length) * 10) / 10;
  const mine = valid.find((row) => row.user_id === userId);

  return {
    scope,
    areaId,
    average,
    count: valid.length,
    myRating: mine ? mine.rating : null,
  };
}
