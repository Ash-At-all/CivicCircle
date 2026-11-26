import { cellToLatLng, cellToParent, getResolution, isValidCell, latLngToCell } from "h3-js";
import {
  DEFAULT_CITY_SLUG,
  getCityConfig,
  inCityBounds as cityInBounds,
  type CityBounds,
  type CitySlug,
} from "./cities";

export { CITY_SLUGS, DEFAULT_CITY_SLUG } from "./cities";
export type { CitySlug } from "./cities";

/** Default city kept for callers that do not pass a city yet. */
export const CITY_SLUG: CitySlug = DEFAULT_CITY_SLUG;

const DEFAULT_CITY = getCityConfig(DEFAULT_CITY_SLUG);

export const CITY_BOUNDS: CityBounds = DEFAULT_CITY?.bounds ?? {
  minLat: 19.75,
  maxLat: 20.05,
  minLng: 75.25,
  maxLng: 75.55,
};

export const RESOLUTIONS = {
  locality: 8,
  ward: 7,
  city: 5,
} as const;

export type AreaKind = keyof typeof RESOLUTIONS;

export function inCityBounds(lat: number, lng: number, citySlug?: string | null) {
  return cityInBounds(lat, lng, citySlug);
}

export function isCellOfResolution(cell: string, resolution: number) {
  return isValidCell(cell) && getResolution(cell) === resolution;
}

export function coordsToAreaCells(
  lat: number,
  lng: number,
  citySlug: string = DEFAULT_CITY_SLUG,
) {
  if (!inCityBounds(lat, lng, citySlug)) {
    throw new Error("Location is outside the supported city.");
  }
  const h3r8 = latLngToCell(lat, lng, RESOLUTIONS.locality);
  const h3r7 = cellToParent(h3r8, RESOLUTIONS.ward);
  const city = getCityConfig(citySlug);
  const h3r5 = city?.h3r5 ?? cellToParent(h3r8, RESOLUTIONS.city);
  return { h3r8, h3r7, h3r5 };
}

export function cellCentroid(cell: string) {
  if (!isValidCell(cell)) throw new Error("Invalid H3 cell.");
  const [lat, lng] = cellToLatLng(cell);
  return { lat, lng };
}

export function validateAreaCell(kind: AreaKind, cell: string) {
  return isCellOfResolution(cell, RESOLUTIONS[kind]);
}
