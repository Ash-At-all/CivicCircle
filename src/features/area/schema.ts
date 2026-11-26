import { z } from "zod";
import { CITY_SLUGS } from "./cities";

const h3r8 = z.string().regex(/^88[0-9a-f]{13}$/);
const h3r7 = z.string().regex(/^87[0-9a-f]{13}$/);
const h3r5 = z.string().regex(/^85[0-9a-f]{13}$/);
const citySlug = z.enum(CITY_SLUGS);

export const areaCellsSchema = z.object({
  h3r8,
  h3r7,
  h3r5,
}).strict();

/**
 * The server derives the canonical city H3 cell from the city config, so the
 * request only carries the locality and ward cells plus the city slug.
 */
export const resolveAreaSchema = z.object({
  h3r8,
  h3r7,
  city: citySlug,
}).strict();

export const nearbyQuerySchema = z.object({
  h3r8,
});

export const presenceSchema = z.object({
  areaId: z.string().uuid(),
  optIn: z.boolean().optional(),
}).strict();

export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
}).strict();
