import { z } from "zod";

const h3r8 = z.string().regex(/^88[0-9a-f]{13}$/);
const h3r7 = z.string().regex(/^87[0-9a-f]{13}$/);
const h3r5 = z.string().regex(/^85[0-9a-f]{13}$/);

export const areaCellsSchema = z.object({
  h3r8,
  h3r7,
  h3r5,
}).strict();

export const resolveAreaSchema = areaCellsSchema;

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
