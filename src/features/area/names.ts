export const DEFAULT_CITY_NAME = "Chhatrapati Sambhajinagar";
export const DEFAULT_CITY_NAME_HI = "छत्रपती संभाजीनगर";

export function fallbackAreaName(kind: "locality" | "ward" | "city") {
  if (kind === "city") return DEFAULT_CITY_NAME;
  if (kind === "ward") return "Zone";
  return "Your locality";
}
