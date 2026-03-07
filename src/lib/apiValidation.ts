/**
 * Zod schemas for external API responses — validates before use to prevent crashes/XSS.
 */
import { z } from "zod";

/** Nominatim single result (OSM geocoding) */
const NominatimAddress = z.object({
  road: z.string().optional(),
  house_number: z.string().optional(),
  postcode: z.string().optional(),
  city: z.string().optional(),
  town: z.string().optional(),
  village: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
}).passthrough();

export const NominatimResultSchema = z.object({
  display_name: z.string(),
  address: NominatimAddress.optional().default({}),
  lat: z.union([z.string(), z.number()]).optional(),
  lon: z.union([z.string(), z.number()]).optional(),
  place_id: z.union([z.string(), z.number()]).optional(),
}).passthrough();

export type NominatimResult = z.infer<typeof NominatimResultSchema>;

/** Parse Nominatim response — returns empty array on invalid data */
export function parseNominatimResponse(data: unknown): NominatimResult[] {
  const arr = Array.isArray(data) ? data : [];
  return arr
    .map((item) => {
      const parsed = NominatimResultSchema.safeParse(item);
      return parsed.success ? parsed.data : null;
    })
    .filter((r): r is NominatimResult => r !== null);
}
