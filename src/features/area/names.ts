import { DEFAULT_CITY_SLUG, getCityConfig } from "./cities";

const DEFAULT_CITY = getCityConfig(DEFAULT_CITY_SLUG);

export const DEFAULT_CITY_NAME = DEFAULT_CITY?.name ?? "Chhatrapati Sambhajinagar";
export const DEFAULT_CITY_NAME_HI = DEFAULT_CITY?.nameHi ?? "छत्रपती संभाजीनगर";

export function fallbackAreaName(kind: "locality" | "ward" | "city") {
  if (kind === "city") return DEFAULT_CITY_NAME;
  if (kind === "ward") return "Zone";
  return "Your locality";
}
