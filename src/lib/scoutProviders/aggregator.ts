/**
 * Aggregation mehrerer Scout-Provider: Aufruf aller aktiven Provider,
 * Zusammenführen und Deduplizierung der POIs, Anreicherung mit Gebäudeflächen.
 * Gebäude: Brandenburg ALKIS bevorzugt, wenn BBox/Umkreis in Brandenburg liegt.
 */
import type { ScoutPOI, PlaceBbox, BuildingWithSize, GeocodeResult } from "./types";
import type { ScoutProvider } from "./types";
import { distanceMeters, dedupeScoutResults } from "@/lib/crmUtils";
import { isBboxInBrandenburg, isPointInBrandenburgForBuildings } from "./brandenburgProvider";

const MAX_BUILDING_DIST_M = 85;

/** Geschätzte Fläche an POIs hängen (nächstes Gebäude innerhalb maxDistM). */
export function attachBuildingSizesToScoutPOIs(
  pois: ScoutPOI[],
  buildings: BuildingWithSize[],
  maxDistM = MAX_BUILDING_DIST_M
): ScoutPOI[] {
  return pois.map((poi) => {
    let best: BuildingWithSize | null = null;
    let bestDist = maxDistM + 1;
    const p = { lat: poi.lat, lon: poi.lon };
    for (const b of buildings) {
      const d = distanceMeters(p, { lat: b.lat, lon: b.lon });
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    return {
      ...poi,
      estimatedGrossArea: best ? best.estimatedGrossArea : null,
      parcelArea: best?.parcelArea ?? null,
    };
  });
}

export function dedupeScoutPOIs<T extends ScoutPOI>(items: T[]): T[] {
  return dedupeScoutResults(items) as T[];
}

/** Erste Geocode-Antwort unter den aktiven Providern. */
export async function aggregateGeocode(
  providers: ScoutProvider[],
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  for (const p of providers) {
    if (!p.geocode) continue;
    try {
      const r = await p.geocode(query, signal);
      if (r) return r;
    } catch {
      continue;
    }
  }
  return null;
}

/** Erste Bbox-Antwort unter den aktiven Providern. */
export async function aggregateGeocodeToBbox(
  providers: ScoutProvider[],
  query: string,
  signal?: AbortSignal
): Promise<PlaceBbox | null> {
  for (const p of providers) {
    if (!p.geocodeToBbox) continue;
    try {
      const r = await p.geocodeToBbox(query, signal);
      if (r) return r;
    } catch {
      continue;
    }
  }
  return null;
}

/** Ab welcher Bbox-Fläche (in Grad²) wird in 2x2 Kacheln geteilt (große Orte, weniger Timeout). */
const BBOX_SPLIT_THRESHOLD_DEG2 = 0.008;

function splitBbox(bbox: PlaceBbox): PlaceBbox[] {
  const { south, north, west, east } = bbox;
  const midLat = (south + north) / 2;
  const midLon = (west + east) / 2;
  return [
    { ...bbox, south, north: midLat, west, east: midLon, display_name: bbox.display_name },
    { ...bbox, south: midLat, north, west, east: midLon, display_name: bbox.display_name },
    { ...bbox, south, north: midLat, west: midLon, east, display_name: bbox.display_name },
    { ...bbox, south: midLat, north, west: midLon, east, display_name: bbox.display_name },
  ];
}

/** POIs aus allen Providern (Bbox), zusammenführen und deduplizieren. Bei großer Bbox: 2x2-Split. */
export async function aggregatePOIsByBbox(
  providers: ScoutProvider[],
  bbox: PlaceBbox,
  signal?: AbortSignal
): Promise<{ pois: ScoutPOI[]; buildings: BuildingWithSize[] }> {
  const areaDeg2 = (bbox.north - bbox.south) * (bbox.east - bbox.west);
  const bboxes = areaDeg2 > BBOX_SPLIT_THRESHOLD_DEG2 ? splitBbox(bbox) : [bbox];

  const withBbox = providers.filter((p) => p.fetchPOIsByBbox);
  const allPois: ScoutPOI[] = [];
  let allBuildings: BuildingWithSize[] = [];

  for (const b of bboxes) {
    if (signal?.aborted) break;
    const results = await Promise.all(
      withBbox.map((p) => p.fetchPOIsByBbox!(b, signal).catch(() => [] as ScoutPOI[]))
    );
    allPois.push(...results.flat());

    const buildingProviders = providers.filter((p) => p.fetchBuildingsByBbox);
    const preferBrandenburg = isBboxInBrandenburg(b);
    const buildingProvider = preferBrandenburg && buildingProviders.some((p) => p.id === "brandenburg")
      ? buildingProviders.find((p) => p.id === "brandenburg") ?? buildingProviders[0]
      : buildingProviders[0];
    if (buildingProvider?.fetchBuildingsByBbox) {
      try {
        const buildings = await buildingProvider.fetchBuildingsByBbox(b, signal);
        allBuildings.push(...buildings);
      } catch {
        // ignore
      }
    }
  }

  let pois = attachBuildingSizesToScoutPOIs(allPois, allBuildings);
  pois = dedupeScoutPOIs(pois);
  return { pois, buildings: allBuildings };
}

/** POIs aus allen Providern (Umkreis), zusammenführen und deduplizieren. */
export async function aggregatePOIsByRadius(
  providers: ScoutProvider[],
  lat: number,
  lng: number,
  radiusM: number,
  signal?: AbortSignal
): Promise<{ pois: ScoutPOI[]; buildings: BuildingWithSize[] }> {
  const withRadius = providers.filter((p) => p.fetchPOIsByRadius);
  const results = await Promise.all(
    withRadius.map((p) => p.fetchPOIsByRadius!(lat, lng, radiusM, signal).catch(() => [] as ScoutPOI[]))
  );
  let pois: ScoutPOI[] = results.flat();

  let buildings: BuildingWithSize[] = [];
  const buildingProviders = providers.filter((p) => p.fetchBuildingsByRadius);
  const preferBrandenburg = isPointInBrandenburgForBuildings(lat, lng);
  const buildingProvider = preferBrandenburg && buildingProviders.some((p) => p.id === "brandenburg")
    ? buildingProviders.find((p) => p.id === "brandenburg") ?? buildingProviders[0]
    : buildingProviders[0];
  if (buildingProvider?.fetchBuildingsByRadius) {
    try {
      buildings = await buildingProvider.fetchBuildingsByRadius(lat, lng, radiusM, signal);
    } catch {
      // ignore
    }
  }
  pois = attachBuildingSizesToScoutPOIs(pois, buildings);
  pois = dedupeScoutPOIs(pois);
  return { pois, buildings };
}
