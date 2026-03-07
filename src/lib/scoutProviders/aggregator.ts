/**
 * Aggregation mehrerer Scout-Provider: Aufruf aller aktiven Provider,
 * Zusammenführen und Deduplizierung der POIs, Anreicherung mit Gebäudeflächen (OSM).
 */
import type { ScoutPOI, PlaceBbox, BuildingWithSize, GeocodeResult } from "./types";
import type { ScoutProvider } from "./types";
import { distanceMeters, dedupeScoutResults } from "@/lib/crmUtils";

const MAX_BUILDING_DIST_M = 60;

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

/** POIs aus allen Providern (Bbox), zusammenführen und deduplizieren. */
export async function aggregatePOIsByBbox(
  providers: ScoutProvider[],
  bbox: PlaceBbox,
  signal?: AbortSignal
): Promise<{ pois: ScoutPOI[]; buildings: BuildingWithSize[] }> {
  const withBbox = providers.filter((p) => p.fetchPOIsByBbox);
  const results = await Promise.all(
    withBbox.map((p) => p.fetchPOIsByBbox!(bbox, signal).catch(() => [] as ScoutPOI[]))
  );
  let pois: ScoutPOI[] = results.flat();

  let buildings: BuildingWithSize[] = [];
  const withBuildings = providers.find((p) => p.fetchBuildingsByBbox);
  if (withBuildings?.fetchBuildingsByBbox) {
    try {
      buildings = await withBuildings.fetchBuildingsByBbox(bbox, signal);
    } catch {
      // ignore
    }
  }
  pois = attachBuildingSizesToScoutPOIs(pois, buildings);
  pois = dedupeScoutPOIs(pois);
  return { pois, buildings };
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
  const withBuildings = providers.find((p) => p.fetchBuildingsByRadius);
  if (withBuildings?.fetchBuildingsByRadius) {
    try {
      buildings = await withBuildings.fetchBuildingsByRadius(lat, lng, radiusM, signal);
    } catch {
      // ignore
    }
  }
  pois = attachBuildingSizesToScoutPOIs(pois, buildings);
  pois = dedupeScoutPOIs(pois);
  return { pois, buildings };
}
