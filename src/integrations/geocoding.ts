/**
 * Geocoding – tool-agnostic API.
 * Uses Google Geocoding API when VITE_GOOGLE_PLACES_API_KEY is set,
 * otherwise Nominatim (OSM).
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

export interface PlaceBbox {
  south: number;
  north: number;
  west: number;
  east: number;
  display_name: string;
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

/** Google Geocoding API – address to lat/lng. */
async function googleGeocodeToCoord(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  if (!GOOGLE_API_KEY?.trim()) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=de&language=de&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{
      formatted_address?: string;
      geometry?: {
        location?: { lat: number; lng: number };
        viewport?: {
          northeast?: { lat: number; lng: number };
          southwest?: { lat: number; lng: number };
        };
      };
    }>;
  };
  const r = data.results?.[0];
  if (!r?.geometry?.location) return null;
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    display_name: r.formatted_address ?? query,
  };
}

/** Google Geocoding API – address to bounding box (whole place). */
async function googleGeocodeToBbox(
  query: string,
  signal?: AbortSignal
): Promise<PlaceBbox | null> {
  if (!GOOGLE_API_KEY?.trim()) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=de&language=de&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{
      formatted_address?: string;
      geometry?: {
        location?: { lat: number; lng: number };
        viewport?: {
          northeast?: { lat: number; lng: number };
          southwest?: { lat: number; lng: number };
        };
      };
    }>;
  };
  const r = data.results?.[0];
  if (!r) return null;
  const vp = r.geometry?.viewport;
  const display_name = r.formatted_address ?? query;
  if (vp?.southwest && vp?.northeast) {
    return {
      south: vp.southwest.lat,
      north: vp.northeast.lat,
      west: vp.southwest.lng,
      east: vp.northeast.lng,
      display_name,
    };
  }
  const loc = r.geometry?.location;
  const delta = 0.01;
  return {
    south: (loc?.lat ?? 0) - delta,
    north: (loc?.lat ?? 0) + delta,
    west: (loc?.lng ?? 0) - delta,
    east: (loc?.lng ?? 0) + delta,
    display_name,
  };
}

/** Nominatim geocode – address to lat/lng. */
async function nominatimGeocodeToCoord(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  const { parseNominatimResponse } = await import("@/lib/apiValidation");
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de`;
  const res = await fetch(url, {
    headers: { "User-Agent": "ImmoControl/2.0" },
    ...(signal && { signal }),
  });
  if (!res.ok) return null;
  const raw = await res.json();
  const data = parseNominatimResponse(Array.isArray(raw) ? raw : []);
  if (data.length === 0) return null;
  const item = data[0];
  const lat = typeof item.lat === "string" ? parseFloat(item.lat) : (item.lat ?? 0);
  const lon = typeof item.lon === "string" ? parseFloat(item.lon) : (item.lon ?? 0);
  return { lat, lng: lon, display_name: item.display_name ?? "" };
}

/** Nominatim geocode – address to bounding box. */
async function nominatimGeocodeToBbox(
  query: string,
  signal?: AbortSignal
): Promise<PlaceBbox | null> {
  const { parseNominatimResponse } = await import("@/lib/apiValidation");
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de`;
  const res = await fetch(url, {
    headers: { "User-Agent": "ImmoControl/2.0" },
    ...(signal && { signal }),
  });
  if (!res.ok) return null;
  const raw = await res.json();
  const arr = Array.isArray(raw) ? raw : [];
  const parsed = parseNominatimResponse(arr);
  if (parsed.length === 0) return null;
  const item = arr[0];
  const display_name = parsed[0].display_name ?? "";
  if (item?.boundingbox && Array.isArray(item.boundingbox) && item.boundingbox.length >= 4) {
    const [south, north, west, east] = item.boundingbox.map((v: string | number) =>
      typeof v === "string" ? parseFloat(v) : v
    );
    return { south, north, west, east, display_name };
  }
  const lat = typeof parsed[0].lat === "string" ? parseFloat(parsed[0].lat) : (parsed[0].lat ?? 0);
  const lon = typeof parsed[0].lon === "string" ? parseFloat(parsed[0].lon) : (parsed[0].lon ?? 0);
  const delta = 0.01;
  return { south: lat - delta, north: lat + delta, west: lon - delta, east: lon + delta, display_name };
}

/**
 * Geocode address to lat/lng.
 * Prefers Google when API key is set; otherwise Nominatim.
 */
export async function geocodeToCoord(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  if (!query?.trim()) return null;
  if (GOOGLE_API_KEY?.trim()) {
    const r = await googleGeocodeToCoord(query.trim(), signal);
    if (r) return r;
  }
  return nominatimGeocodeToCoord(query.trim(), signal);
}

/**
 * Geocode address/place to bounding box.
 * Prefers Google when API key is set; otherwise Nominatim.
 */
export async function geocodePlaceToBbox(
  query: string,
  signal?: AbortSignal
): Promise<PlaceBbox | null> {
  if (!query?.trim()) return null;
  if (GOOGLE_API_KEY?.trim()) {
    const r = await googleGeocodeToBbox(query.trim(), signal);
    if (r) return r;
  }
  return nominatimGeocodeToBbox(query.trim(), signal);
}
