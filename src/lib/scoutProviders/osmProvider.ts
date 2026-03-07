/**
 * OpenStreetMap / Nominatim / Overpass als WGH-Scout-Provider.
 * Kostenfrei, keine API-Key-Pflicht; Datenqualität und Vollständigkeit variieren.
 */
import type { ScoutProvider, GeocodeResult, PlaceBbox, ScoutPOI, BuildingWithSize } from "./types";
import {
  geocodeToCoord,
  geocodePlaceToBbox,
  fetchCommercialPOIsInBbox,
  fetchCommercialPOIsInRadius,
  fetchBuildingsInBbox,
  fetchBuildingsInRadius,
  type PlaceBbox as CrmPlaceBbox,
  type CommercialPOIWithCoord,
} from "@/lib/crmUtils";

const SOURCE_ID = "openstreetmap";

function toScoutPOI(poi: CommercialPOIWithCoord): ScoutPOI {
  return {
    ...poi,
    source: SOURCE_ID,
  };
}

export const osmScoutProvider: ScoutProvider = {
  id: SOURCE_ID,
  name: "OpenStreetMap",

  async geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
    const r = await geocodeToCoord(query, signal);
    return r ? { lat: r.lat, lng: r.lng, display_name: r.display_name } : null;
  },

  async geocodeToBbox(query: string, signal?: AbortSignal): Promise<PlaceBbox | null> {
    return geocodePlaceToBbox(query, signal) as Promise<PlaceBbox | null>;
  },

  async fetchPOIsByBbox(bbox: PlaceBbox, signal?: AbortSignal): Promise<ScoutPOI[]> {
    const list = await fetchCommercialPOIsInBbox(bbox as CrmPlaceBbox, signal);
    return list.map(toScoutPOI);
  },

  async fetchPOIsByRadius(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<ScoutPOI[]> {
    const list = await fetchCommercialPOIsInRadius(lat, lng, radiusM, signal);
    return list.map(toScoutPOI);
  },

  async fetchBuildingsByBbox(bbox: PlaceBbox, signal?: AbortSignal): Promise<BuildingWithSize[]> {
    return fetchBuildingsInBbox(bbox as CrmPlaceBbox, signal);
  },

  async fetchBuildingsByRadius(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<BuildingWithSize[]> {
    return fetchBuildingsInRadius(lat, lng, radiusM, signal);
  },
};
