/**
 * WGH-Scout: Provider-Abstraktion für Karten- und Gewerbedaten.
 * Aktuell: OpenStreetMap (Nominatim + Overpass). Erweiterbar um Google Places,
 * Foursquare, HERE, Mapbox, Yelp etc. – keine Quelle geht verloren.
 *
 * Konfiguration: VITE_SCOUT_PROVIDERS=openstreetmap,google (kommagetrennt).
 * Standard: nur OpenStreetMap.
 */
import type { ScoutProvider, ScoutPOI, PlaceBbox, GeocodeResult, BuildingWithSize } from "./types";
import { osmScoutProvider } from "./osmProvider";
import {
  aggregateGeocode as aggGeocode,
  aggregateGeocodeToBbox as aggGeocodeToBbox,
  aggregatePOIsByBbox as aggPOIsByBbox,
  aggregatePOIsByRadius as aggPOIsByRadius,
  attachBuildingSizesToScoutPOIs,
  dedupeScoutPOIs,
} from "./aggregator";

export type { ScoutProvider, ScoutPOI, PlaceBbox, GeocodeResult, BuildingWithSize } from "./types";
export { attachBuildingSizesToScoutPOIs, dedupeScoutPOIs } from "./aggregator";

const PROVIDER_REGISTRY: Map<string, ScoutProvider> = new Map([
  [osmScoutProvider.id, osmScoutProvider],
  // Weitere Provider hier registrieren, sobald implementiert:
  // [googleScoutProvider.id, googleScoutProvider],
  // [foursquareScoutProvider.id, foursquareScoutProvider],
]);

/** Kommagetrennte Liste aus Env (z. B. "openstreetmap,google"). Default: openstreetmap. */
function getActiveProviderIds(): string[] {
  const raw = typeof import.meta !== "undefined" && import.meta.env?.VITE_SCOUT_PROVIDERS;
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean);
  }
  return ["openstreetmap"];
}

/** Alle registrierten Provider. */
export function getAllProviders(): ScoutProvider[] {
  return Array.from(PROVIDER_REGISTRY.values());
}

/** Nur aktivierte Provider (laut Konfiguration). */
export function getActiveProviders(): ScoutProvider[] {
  const ids = getActiveProviderIds();
  return ids
    .map((id) => PROVIDER_REGISTRY.get(id))
    .filter((p): p is ScoutProvider => p != null);
}

/** Geocoding über ersten aktiven Provider. */
export async function aggregateGeocode(query: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
  return aggGeocode(getActiveProviders(), query, signal);
}

/** Bbox für „Ganzer Ort“ über ersten aktiven Provider. */
export async function aggregateGeocodeToBbox(query: string, signal?: AbortSignal): Promise<PlaceBbox | null> {
  return aggGeocodeToBbox(getActiveProviders(), query, signal);
}

/** POIs + Gebäude (Bbox) aus allen aktiven Providern, zusammengeführt und dedupliziert. */
export async function aggregatePOIsByBbox(
  bbox: PlaceBbox,
  signal?: AbortSignal
): Promise<{ pois: ScoutPOI[]; buildings: BuildingWithSize[] }> {
  return aggPOIsByBbox(getActiveProviders(), bbox, signal);
}

/** POIs + Gebäude (Umkreis) aus allen aktiven Providern, zusammengeführt und dedupliziert. */
export async function aggregatePOIsByRadius(
  lat: number,
  lng: number,
  radiusM: number,
  signal?: AbortSignal
): Promise<{ pois: ScoutPOI[]; buildings: BuildingWithSize[] }> {
  return aggPOIsByRadius(getActiveProviders(), lat, lng, radiusM, signal);
}

/** Einen weiteren Provider registrieren (für z. B. Google Places später). */
export function registerScoutProvider(provider: ScoutProvider): void {
  PROVIDER_REGISTRY.set(provider.id, provider);
}
