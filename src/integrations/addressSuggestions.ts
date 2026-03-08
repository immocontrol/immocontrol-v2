/**
 * Address autocomplete – tool-agnostic API.
 * Uses Google Places API (New) when VITE_GOOGLE_PLACES_API_KEY is set,
 * otherwise Photon (Komoot) + Nominatim (OSM) fallback.
 */

export interface AddressSuggestion {
  formatted: string;
  subtitle?: string;
}

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
const GOOGLE_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

/** Google Places (New) autocomplete – Germany-focused, German language */
async function fetchGoogleSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  if (!GOOGLE_PLACES_API_KEY?.trim()) return [];

  const body = {
    input: query,
    includedRegionCodes: ["de"],
    languageCode: "de",
  };

  const res = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "suggestions.placePrediction.text",
    },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn("[addressSuggestions] Google Places autocomplete error:", res.status, err);
    return [];
  }

  const data = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        text?: { text?: string };
      };
    }>;
  };

  const out: AddressSuggestion[] = [];
  for (const s of data.suggestions ?? []) {
    const text = s.placePrediction?.text?.text?.trim();
    if (text) out.push({ formatted: text });
  }
  return out.slice(0, 6);
}

/** Photon (Komoot) – DACH region */
async function fetchPhoton(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "6",
    lang: "de",
    bbox: "5.87,46.27,16.60,55.10",
  });
  const url = `https://photon.komoot.io/api/?${params}&osm_tag=place&osm_tag=highway&osm_tag=building`;
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error("Photon API error");
  const data = (await res.json()) as {
    features?: Array<{
      properties?: {
        name?: string;
        street?: string;
        housenumber?: string;
        postcode?: string;
        city?: string;
        district?: string;
        state?: string;
        countrycode?: string;
        osm_key?: string;
      };
    }>;
  };

  const format = (p: NonNullable<typeof data.features>[0]["properties"]) => {
    const parts: string[] = [];
    if (p.street) {
      parts.push(p.housenumber ? `${p.street} ${p.housenumber}` : p.street);
    } else if (p.name && p.osm_key !== "place") {
      parts.push(p.name);
    }
    if (p.postcode || p.city) {
      parts.push([p.postcode, p.city].filter(Boolean).join(" "));
    }
    if (parts.length === 0 && p.name) {
      parts.push(p.name);
      if (p.state) parts.push(p.state);
    }
    return parts.join(", ");
  };

  const subtitle = (p: NonNullable<typeof data.features>[0]["properties"]) => {
    const parts: string[] = [];
    if (p.district && p.district !== p.city) parts.push(p.district);
    if (p.state) parts.push(p.state);
    if (p.countrycode) parts.push(p.countrycode.toUpperCase());
    return parts.join(", ");
  };

  return (data.features ?? []).map((f) => {
    const p = f.properties ?? {};
    return { formatted: format(p), subtitle: subtitle(p) || undefined };
  });
}

/** Nominatim (OSM) – fallback */
async function fetchNominatim(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const { parseNominatimResponse } = await import("@/lib/apiValidation");
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "5",
    countrycodes: "de,at,ch",
    "accept-language": "de",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "ImmoControl/2.0" },
    signal: signal ?? AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error("Nominatim API error");
  const raw = await res.json();
  const results = parseNominatimResponse(raw);
  return results.map((r) => {
    const a = r.address ?? {};
    const city = a.city ?? a.town ?? a.village;
    const line1 = [a.road, a.house_number].filter(Boolean).join(" ") || a.country;
    const line2 = [a.postcode, city].filter(Boolean).join(" ");
    const formatted = [line1, line2].filter(Boolean).join(", ");
    const subtitle = [a.state, a.country].filter(Boolean).join(", ");
    return { formatted: formatted || (r.display_name ?? ""), subtitle: subtitle || undefined };
  });
}

/**
 * Fetch address suggestions for autocomplete.
 * Prefers Google Places if API key is set; otherwise Photon with Nominatim fallback.
 */
export async function fetchAddressSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  if (GOOGLE_PLACES_API_KEY?.trim()) {
    const list = await fetchGoogleSuggestions(q, signal);
    if (list.length > 0) return list;
    // On empty or error, fall through to Photon/Nominatim
  }

  try {
    let list = await fetchPhoton(q, signal);
    if (list.length === 0) list = await fetchNominatim(q, signal);
    const seen = new Set<string>();
    return list.filter((s) => {
      if (!s.formatted || seen.has(s.formatted)) return false;
      seen.add(s.formatted);
      return true;
    }).slice(0, 6);
  } catch {
    try {
      return (await fetchNominatim(q, signal)).slice(0, 5);
    } catch {
      return [];
    }
  }
}

/** Whether the current suggestions are from Google (for attribution). */
export function isGooglePlacesEnabled(): boolean {
  return Boolean(GOOGLE_PLACES_API_KEY?.trim());
}
