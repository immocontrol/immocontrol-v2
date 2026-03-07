/**
 * WGH-Scout: Gemeinsame Typen für alle Karten-/POI-Provider.
 * Ermöglicht späteres Anreichern mit Google Places, Foursquare, HERE, etc.
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

/** Ein Gewerbe-POI mit Koordinaten (kann von OSM, Google, Foursquare, … kommen). */
export interface ScoutPOI {
  name: string;
  type: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  distance: number;
  address: string | null;
  opening_hours: string | null;
  lat: number;
  lon: number;
  /** Quelle des Eintrags (z. B. "openstreetmap", "google", "foursquare"). */
  source: string;
  /** Geschätzte Bruttofläche in m², falls vom Provider/OSM-Gebäudedaten. */
  estimatedGrossArea?: number | null;
  /** Amtliche Grundstücksfläche in m² (z. B. aus ALKIS Flurstück), falls verfügbar. */
  parcelArea?: number | null;
}

export interface BuildingWithSize {
  lat: number;
  lon: number;
  estimatedGrossArea: number;
  footprintArea: number;
  /** Amtliche Grundstücksfläche in m² (ALKIS Flurstück), falls verfügbar. */
  parcelArea?: number | null;
}

/**
 * Ein Karten-/POI-Provider für den WGH-Scout.
 * Nicht alle Provider unterstützen alle Methoden (z. B. Gebäudeflächen nur OSM/Overpass).
 */
export interface ScoutProvider {
  /** Eindeutige ID (z. B. "openstreetmap", "google"). */
  id: string;
  /** Anzeigename (z. B. "OpenStreetMap"). */
  name: string;
  /** Geocoding: Adresse/Ort → Koordinate. */
  geocode?(query: string, signal?: AbortSignal): Promise<GeocodeResult | null>;
  /** Geocoding: Ort → Bounding Box (für "Ganzer Ort"). */
  geocodeToBbox?(query: string, signal?: AbortSignal): Promise<PlaceBbox | null>;
  /** POIs in einer Bounding Box (Ganzer Ort). */
  fetchPOIsByBbox?(bbox: PlaceBbox, signal?: AbortSignal): Promise<ScoutPOI[]>;
  /** POIs im Umkreis um einen Punkt. */
  fetchPOIsByRadius?(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<ScoutPOI[]>;
  /** Gebäude mit Fläche in Bbox (optional; nur OSM/Overpass liefert das). */
  fetchBuildingsByBbox?(bbox: PlaceBbox, signal?: AbortSignal): Promise<BuildingWithSize[]>;
  /** Gebäude mit Fläche im Umkreis (optional). */
  fetchBuildingsByRadius?(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<BuildingWithSize[]>;
}
