/**
 * Launch cities for the area module.
 *
 * The bounds are approximate city boxes, not official boundaries. They keep
 * geocoding, shop pins, map panning, and area creation inside a supported city.
 *
 * Keep this list in sync with supabase/migrations/20261114093200_add_cities.sql.
 */

export const CITY_SLUGS = [
  "sambhajinagar",
  "pune",
  "mumbai",
  "nagpur",
  "nashik",
] as const;

export type CitySlug = (typeof CITY_SLUGS)[number];

export type CityBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type CityConfig = {
  slug: CitySlug;
  name: string;
  nameHi: string;
  bounds: CityBounds;
  centroid: { lat: number; lng: number };
  /** H3 resolution 5 cell used as the canonical city area row. */
  h3r5: string;
};

export const CITY_CONFIGS: readonly CityConfig[] = [
  {
    slug: "sambhajinagar",
    name: "Chhatrapati Sambhajinagar",
    nameHi: "छत्रपती संभाजीनगर",
    bounds: { minLat: 19.75, maxLat: 20.05, minLng: 75.25, maxLng: 75.55 },
    centroid: { lat: 19.949389927734455, lng: 75.37063270084657 },
    h3r5: "85609c37fffffff",
  },
  {
    slug: "pune",
    name: "Pune",
    nameHi: "पुणे",
    bounds: { minLat: 18.4, maxLat: 18.65, minLng: 73.75, maxLng: 74.05 },
    centroid: { lat: 18.5204, lng: 73.8567 },
    h3r5: "85608853fffffff",
  },
  {
    slug: "mumbai",
    name: "Mumbai",
    nameHi: "मुंबई",
    bounds: { minLat: 18.9, maxLat: 19.3, minLng: 72.75, maxLng: 73.05 },
    centroid: { lat: 19.076, lng: 72.8777 },
    h3r5: "85608b57fffffff",
  },
  {
    slug: "nagpur",
    name: "Nagpur",
    nameHi: "नागपूर",
    bounds: { minLat: 21.05, maxLat: 21.25, minLng: 78.95, maxLng: 79.25 },
    centroid: { lat: 21.1458, lng: 79.0882 },
    h3r5: "85609613fffffff",
  },
  {
    slug: "nashik",
    name: "Nashik",
    nameHi: "नाशिक",
    bounds: { minLat: 19.95, maxLat: 20.1, minLng: 73.7, maxLng: 73.9 },
    centroid: { lat: 19.9975, lng: 73.7898 },
    h3r5: "856099a3fffffff",
  },
];

export const DEFAULT_CITY_SLUG: CitySlug = "sambhajinagar";

export function getCityConfig(slug: string | null | undefined): CityConfig | null {
  if (!slug) return null;
  return CITY_CONFIGS.find((city) => city.slug === slug) ?? null;
}

export function isCitySlug(slug: string): slug is CitySlug {
  return CITY_CONFIGS.some((city) => city.slug === slug);
}

export function isInsideCityBounds(
  city: CityConfig,
  lat: number,
  lng: number,
): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= city.bounds.minLat &&
    lat <= city.bounds.maxLat &&
    lng >= city.bounds.minLng &&
    lng <= city.bounds.maxLng
  );
}

export function findCityForCoords(lat: number, lng: number): CityConfig | null {
  return CITY_CONFIGS.find((city) => isInsideCityBounds(city, lat, lng)) ?? null;
}

export function inCityBounds(
  lat: number,
  lng: number,
  slug?: string | null,
): boolean {
  if (slug) {
    const city = getCityConfig(slug);
    return city ? isInsideCityBounds(city, lat, lng) : false;
  }
  return findCityForCoords(lat, lng) !== null;
}

/** MapLibre maxBounds value: [[west, south], [east, north]]. */
export function cityBoundsTuple(slug: string): [[number, number], [number, number]] {
  const city = getCityConfig(slug) ?? getCityConfig(DEFAULT_CITY_SLUG);
  if (!city) return [[75.25, 19.75], [75.55, 20.05]];
  return [
    [city.bounds.minLng, city.bounds.minLat],
    [city.bounds.maxLng, city.bounds.maxLat],
  ];
}
