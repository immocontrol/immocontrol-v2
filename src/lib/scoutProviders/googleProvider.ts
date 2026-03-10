/**
 * Google Places API (New) als WGH-Scout-Provider.
 * Nutzt VITE_GOOGLE_PLACES_API_KEY (dasselbe wie Adress-Autocomplete/Geocoding).
 * Liefert POIs per Nearby Search; keine Gebäudeflächen (nur OSM/ALKIS).
 */
import type { ScoutProvider, GeocodeResult, PlaceBbox, ScoutPOI } from "./types";
import { geocodeToCoord, geocodePlaceToBbox } from "@/integrations/geocoding";
import { distanceMeters } from "@/lib/crmUtils";

const SOURCE_ID = "google";
const API_KEY = typeof import.meta !== "undefined" && (import.meta.env?.VITE_GOOGLE_PLACES_API_KEY as string | undefined);
const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.regularOpeningHours,places.primaryType";

/** Typen für WGH-relevante Gewerbe (Restaurant, Laden, Büro, etc.). */
const INCLUDED_TYPES = [
  "restaurant",
  "cafe",
  "bar",
  "store",
  "supermarket",
  "shopping_mall",
  "pharmacy",
  "bank",
  "real_estate_agency",
  "lawyer",
  "insurance_agency",
  "hair_care",
  "dentist",
  "doctor",
  "veterinary_care",
  "food",
  "point_of_interest",
  "establishment",
];

function getApiKey(): string | undefined {
  return API_KEY?.trim() || undefined;
}

export function isGoogleScoutEnabled(): boolean {
  return Boolean(getApiKey());
}

interface PlaceResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
    primaryType?: string;
  }>;
}

async function searchNearby(
  lat: number,
  lng: number,
  radiusM: number,
  signal?: AbortSignal
): Promise<ScoutPOI[]> {
  const key = getApiKey();
  if (!key) return [];
  const body = {
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(Math.max(radiusM, 100), 50000),
      },
    },
    includedTypes: INCLUDED_TYPES,
    maxResultCount: 20,
    languageCode: "de",
    rankPreference: "DISTANCE",
  };
  const res = await fetch(PLACES_NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as PlaceResponse;
  const places = data.places ?? [];
  const center = { lat, lon: lng };
  return places
    .filter((p) => p.location?.latitude != null && p.location?.longitude != null)
    .map((p) => {
      const latP = p.location!.latitude!;
      const lngP = p.location!.longitude!;
      const dist = Math.round(distanceMeters({ lat: latP, lon: lngP }, center));
      const openingHours = p.regularOpeningHours?.weekdayDescriptions?.length
        ? p.regularOpeningHours.weekdayDescriptions.join("; ")
        : null;
      return {
        name: p.displayName?.text ?? "Unbekannt",
        type: p.primaryType ?? "establishment",
        phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
        email: null,
        distance: dist,
        address: p.formattedAddress ?? null,
        opening_hours: openingHours,
        lat: latP,
        lon: lngP,
        source: SOURCE_ID,
      };
    });
}

/** Bbox-Mitte und Radius (halbe Diagonale) in Metern. */
function bboxToCenterAndRadius(bbox: PlaceBbox): { lat: number; lng: number; radiusM: number } {
  const lat = (bbox.south + bbox.north) / 2;
  const lng = (bbox.west + bbox.east) / 2;
  const dLat = (bbox.north - bbox.south) / 2;
  const dLng = (bbox.east - bbox.west) / 2;
  const radiusM = Math.min(50000, Math.round(distanceMeters({ lat, lon: lng }, { lat: lat + dLat, lon: lng + dLng })));
  return { lat, lng, radiusM: Math.max(500, radiusM) };
}

export const googleScoutProvider: ScoutProvider = {
  id: SOURCE_ID,
  name: "Google Places",

  async geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
    const r = await geocodeToCoord(query, signal);
    return r ? { lat: r.lat, lng: r.lng, display_name: r.display_name } : null;
  },

  async geocodeToBbox(query: string, signal?: AbortSignal): Promise<PlaceBbox | null> {
    return geocodePlaceToBbox(query, signal) as Promise<PlaceBbox | null>;
  },

  async fetchPOIsByBbox(bbox: PlaceBbox, signal?: AbortSignal): Promise<ScoutPOI[]> {
    const { lat, lng, radiusM } = bboxToCenterAndRadius(bbox);
    return searchNearby(lat, lng, radiusM, signal);
  },

  async fetchPOIsByRadius(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<ScoutPOI[]> {
    return searchNearby(lat, lng, radiusM, signal);
  },
};
