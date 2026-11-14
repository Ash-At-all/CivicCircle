import { cellToLatLng, cellToParent, getResolution, isValidCell, latLngToCell } from "h3-js";

export const CITY_SLUG = "sambhajinagar";
export const CITY_BOUNDS = {
  minLat: 19.7,
  maxLat: 20.1,
  minLng: 75.1,
  maxLng: 75.6,
} as const;

export const RESOLUTIONS = {
  locality: 8,
  ward: 7,
  city: 5,
} as const;

export type AreaKind = keyof typeof RESOLUTIONS;

export function inCityBounds(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= CITY_BOUNDS.minLat &&
    lat <= CITY_BOUNDS.maxLat &&
    lng >= CITY_BOUNDS.minLng &&
    lng <= CITY_BOUNDS.maxLng
  );
}

export function isCellOfResolution(cell: string, resolution: number) {
  return isValidCell(cell) && getResolution(cell) === resolution;
}

export function coordsToAreaCells(lat: number, lng: number) {
  if (!inCityBounds(lat, lng)) {
    throw new Error("Location is outside the launch city.");
  }
  const h3r8 = latLngToCell(lat, lng, RESOLUTIONS.locality);
  const h3r7 = cellToParent(h3r8, RESOLUTIONS.ward);
  const h3r5 = cellToParent(h3r8, RESOLUTIONS.city);
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
