/**
 * Brandenburg ALKIS (OGC API) – amtliche Gebäude- und Flurstücksdaten.
 * Wird für Suchgebiete in Brandenburg bevorzugt (höhere Zuverlässigkeit als OSM).
 * Datenlizenz Deutschland - Namensnennung 2.0 (GeoBasis-DE/LGB).
 *
 * OGC API: https://ogc-api.geobasis-bb.de/alkis-vereinfacht/v1
 */
import type { ScoutProvider, PlaceBbox, BuildingWithSize } from "./types";
import { calculatePolygonArea } from "@/lib/crmUtils";

const PROVIDER_ID = "brandenburg";
const OGC_BASE = "https://ogc-api.geobasis-bb.de/alkis-vereinfacht/v1";

/** Brandenburg-Begrenzung (BBox) – grob 10.9–14.9°E, 51.3–53.6°N */
const BB_WEST = 10.9;
const BB_EAST = 14.9;
const BB_SOUTH = 51.3;
const BB_NORTH = 53.6;

function isInBrandenburg(bbox: PlaceBbox): boolean {
  const { south, north, west, east } = bbox;
  return west >= BB_WEST && east <= BB_EAST && south >= BB_SOUTH && north <= BB_NORTH;
}

function isPointInBrandenburg(lat: number, lon: number): boolean {
  return lon >= BB_WEST && lon <= BB_EAST && lat >= BB_SOUTH && lat <= BB_NORTH;
}

/** GeoJSON MultiPolygon – coordinates[0][0] = Außenring als [lon,lat][]. */
interface MultiPolygonGeom {
  type: "MultiPolygon";
  coordinates: [number, number][][][];
}

/** Fläche aus GeoJSON MultiPolygon (Außenring des ersten Polygons). */
function polygonAreaFromGeoJSON(geom: MultiPolygonGeom): number {
  const coords = geom.coordinates;
  if (!coords?.[0]?.[0]?.length) return 0;
  const ring = coords[0][0] as [number, number][];
  return calculatePolygonArea(ringToCoords(ring));
}

/** Zentroid aus GeoJSON MultiPolygon (Außenring des ersten Polygons). */
function polygonCentroid(geom: MultiPolygonGeom): { lat: number; lon: number } | null {
  const coords = geom.coordinates;
  if (!coords?.[0]?.[0]?.length) return null;
  const ring = coords[0][0] as [number, number][];
  const n = ring.length;
  let sumLat = 0;
  let sumLon = 0;
  for (let i = 0; i < n; i++) {
    sumLon += ring[i][0];
    sumLat += ring[i][1];
  }
  return { lat: sumLat / n, lon: sumLon / n };
}

interface AlkisFeature {
  type: "Feature";
  id: string;
  geometry: MultiPolygonGeom;
  properties?: {
    oid?: string;
    funktion?: string;
    anzahlgs?: number;
    lagebeztxt?: string;
  };
}

interface AlkisFeatureCollection {
  type: "FeatureCollection";
  features?: AlkisFeature[];
}

async function fetchBuildingsFromOGC(
  bbox: { west: number; south: number; east: number; north: number },
  limit: number,
  signal?: AbortSignal
): Promise<BuildingWithSize[]> {
  const { west, south, east, north } = bbox;
  const bboxParam = `${west},${south},${east},${north}`;
  const url = `${OGC_BASE}/collections/gebaeude_bauwerk/items?bbox=${encodeURIComponent(bboxParam)}&limit=${limit}&f=json`;

  const res = await fetch(url, {
    headers: { Accept: "application/geo+json" },
    ...(signal && { signal }),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as AlkisFeatureCollection;
  const features = data.features ?? [];
  const result: BuildingWithSize[] = [];

  for (const f of features) {
    const geom = f.geometry;
    if (!geom || geom.type !== "MultiPolygon") continue;

    const footprintArea = Math.round(polygonAreaFromGeoJSON(geom));
    if (footprintArea < 20) continue;

    const cent = polygonCentroid(geom);
    if (!cent) continue;

    const levels = f.properties?.anzahlgs ?? 2;
    const estimatedGrossArea = footprintArea * Math.max(1, levels);

    result.push({
      lat: cent.lat,
      lon: cent.lon,
      estimatedGrossArea,
      footprintArea,
    });
  }
  return result;
}

/**
 * Brandenburg ALKIS Provider – nur Gebäudedaten (keine POIs, kein Geocoding).
 * Für den WGH-Scout: Aggregator nutzt diesen Provider, wenn die Suche in Brandenburg liegt.
 */
export const brandenburgScoutProvider: ScoutProvider = {
  id: PROVIDER_ID,
  name: "Brandenburg ALKIS",

  async fetchBuildingsByBbox(bbox: PlaceBbox, signal?: AbortSignal): Promise<BuildingWithSize[]> {
    if (!isInBrandenburg(bbox)) return [];
    const { south, north, west, east } = bbox;
    return fetchBuildingsFromOGC({ west, south, east, north }, 500, signal);
  },

  async fetchBuildingsByRadius(lat: number, lon: number, radiusM: number, signal?: AbortSignal): Promise<BuildingWithSize[]> {
    if (!isPointInBrandenburg(lat, lon)) return [];
    const degPerM = 1 / 111320;
    const delta = (radiusM * degPerM) * Math.max(1, 1 / Math.cos((lat * Math.PI) / 180));
    const west = lon - delta;
    const east = lon + delta;
    const south = lat - degPerM * radiusM;
    const north = lat + degPerM * radiusM;
    return fetchBuildingsFromOGC({ west, south, east, north }, 300, signal);
  },
};

/** Prüfen, ob für eine BBox Brandenburg-Daten verwendet werden sollen. */
export function useBrandenburgBuildings(bbox: PlaceBbox): boolean {
  return isInBrandenburg(bbox);
}

/** Prüfen, ob für einen Punkt Brandenburg-Daten verwendet werden sollen. */
export function useBrandenburgBuildingsForPoint(lat: number, lon: number): boolean {
  return isPointInBrandenburg(lat, lon);
}
