/** IMP-148: CRM utility functions for lead scoring, matching, and deal analysis */
/**
 * CRM utility functions extracted from CRM.tsx for better modularity.
 * Contains geo/building estimation, Nominatim search, and CRM helpers.
 */
import { parseNominatimResponse } from "@/lib/apiValidation";

/* ── Types ── */

export interface SearchPlace {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  rating: number | null;
  open_now: boolean | null;
  source: "google" | "nominatim";
  buildingInfo?: BuildingInfo | null;
}

export interface NearbyBusiness {
  name: string;
  type: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  distance: number;
  address: string | null;
  opening_hours: string | null;
}

export interface BuildingInfo {
  footprintArea: number | null;
  levels: number | null;
  estimatedGrossArea: number | null;
  buildingType: string | null;
  isMFH: boolean;
  confidence: "high" | "medium" | "low";
  buildingCount: number;
  buildings: { area: number; levels: number | null; type: string | null }[];
  nearbyBusinesses: NearbyBusiness[];
}

/* ── Geo helpers ── */

/** Shoelace formula for polygon area in m2 (from lat/lng coordinates) */
export function calculatePolygonArea(coords: { lat: number; lon: number }[]): number {
  const R = 6371000;
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = coords[i].lon * Math.PI / 180 * R * Math.cos(coords[i].lat * Math.PI / 180);
    const yi = coords[i].lat * Math.PI / 180 * R;
    const xj = coords[j].lon * Math.PI / 180 * R * Math.cos(coords[j].lat * Math.PI / 180);
    const yj = coords[j].lat * Math.PI / 180 * R;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area) / 2;
}

/** Calculate centroid of a building's nodes */
export function buildingCentroid(nodeIds: number[], nodeMap: Map<number, { lat: number; lon: number }>): { lat: number; lon: number } | null {
  const coords = nodeIds.map(id => nodeMap.get(id)).filter(Boolean) as { lat: number; lon: number }[];
  if (coords.length === 0) return null;
  const sumLat = coords.reduce((s, c) => s + c.lat, 0);
  const sumLon = coords.reduce((s, c) => s + c.lon, 0);
  return { lat: sumLat / coords.length, lon: sumLon / coords.length };
}

/** Distance between two lat/lon points in meters */
export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dlat = (b.lat - a.lat) * 111320;
  const dlon = (b.lon - a.lon) * 111320 * Math.cos(a.lat * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

/* ── Nominatim search (free, no API key) ── */

export async function searchNominatim(query: string): Promise<SearchPlace[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=10&countrycodes=de&accept-language=de`;
  const res = await fetch(url, {
    headers: { "User-Agent": "ImmoControl/1.0" },
  });
  if (!res.ok) throw new Error("Nominatim-Suche fehlgeschlagen");
  const raw = await res.json();
  const data = parseNominatimResponse(raw);
  return data.map((item) => {
    const addr = item.address ?? {};
    let displayName: string;
    if (addr.road) {
      displayName = addr.house_number ? `${addr.road} ${addr.house_number}` : addr.road;
      const locality = addr.city ?? addr.town ?? addr.village ?? addr.suburb;
      if (locality) displayName += `, ${locality}`;
    } else {
      const parts = item.display_name.split(",").map(s => s.trim());
      displayName = parts.slice(0, 2).join(", ");
    }
    const latNum = typeof item.lat === "string" ? parseFloat(item.lat) : (item.lat ?? 0);
    const lonNum = typeof item.lon === "string" ? parseFloat(item.lon) : (item.lon ?? 0);
    return {
      place_id: `nominatim-${item.place_id ?? ""}`,
      name: displayName,
      address: item.display_name,
      lat: latNum,
      lng: lonNum,
      phone: null,
      website: null,
      rating: null,
      open_now: null,
      source: "nominatim" as const,
      buildingInfo: null,
    };
  });
}

/** Nominatim autocomplete (debounced) — validated response. Optional signal to cancel. */
export async function searchNominatimAutocomplete(query: string, signal?: AbortSignal): Promise<{ display_name: string; place_id: number }[]> {
  if (query.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=de&accept-language=de`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "ImmoControl/1.0" }, ...(signal && { signal }) });
    if (!res.ok) return [];
    const raw = await res.json();
    const data = parseNominatimResponse(raw);
    return data.map(r => ({
      display_name: r.display_name,
      place_id: typeof r.place_id === "number" ? r.place_id : Number(r.place_id) || 0,
    }));
  } catch {
    return [];
  }
}

/* ── OSM Overpass API: building size estimation ── */

const OVERPASS_TIMEOUT_RADIUS = 15;
const OVERPASS_TIMEOUT_BBOX = 25;

export async function estimateBuildingSize(lat: number, lng: number): Promise<BuildingInfo | null> {
  const radius = 20;
  const query = `[out:json][timeout:${OVERPASS_TIMEOUT_RADIUS}];
(
  way["building"](around:${radius},${lat},${lng});
  relation["building"](around:${radius},${lat},${lng});
);
out body;
>;
out skel qt;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const allBuildings = data.elements?.filter((e: { type: string; tags?: Record<string, string> }) =>
      (e.type === "way" || e.type === "relation") && e.tags?.building
    ) || [];
    if (allBuildings.length === 0) return null;

    const nodes = data.elements?.filter((e: { type: string }) => e.type === "node") || [];
    const nodeMap = new Map<number, { lat: number; lon: number }>();
    nodes.forEach((n: { id: number; lat: number; lon: number }) => nodeMap.set(n.id, { lat: n.lat, lon: n.lon }));

    const target = { lat, lon: lng };
    let nearestBuilding = allBuildings[0];
    let nearestDist = Infinity;
    for (const b of allBuildings) {
      if (b.nodes) {
        const cent = buildingCentroid(b.nodes, nodeMap);
        if (cent) {
          const d = distanceMeters(target, cent);
          if (d < nearestDist) { nearestDist = d; nearestBuilding = b; }
        }
      }
    }

    const refTags = nearestBuilding.tags || {};
    const refStreet = refTags["addr:street"] || "";
    const refNumber = refTags["addr:housenumber"] || "";
    let plotBuildings;
    if (refStreet && refNumber) {
      plotBuildings = allBuildings.filter((b: { tags?: Record<string, string> }) => {
        const t = b.tags || {};
        return (t["addr:street"] === refStreet && t["addr:housenumber"] === refNumber);
      });
      for (const b of allBuildings) {
        const t = b.tags || {};
        if (!t["addr:street"] && b.nodes) {
          const cent = buildingCentroid(b.nodes, nodeMap);
          if (cent) {
            const nearestPlotBuilding = plotBuildings.some((pb: { nodes?: number[] }) => {
              if (!pb.nodes) return false;
              const pCent = buildingCentroid(pb.nodes, nodeMap);
              return pCent && distanceMeters(cent, pCent) < 15;
            });
            if (nearestPlotBuilding && !plotBuildings.includes(b)) {
              plotBuildings.push(b);
            }
          }
        }
      }
    } else {
      plotBuildings = allBuildings.filter((b: { nodes?: number[] }) => {
        if (!b.nodes) return false;
        const cent = buildingCentroid(b.nodes, nodeMap);
        return cent && distanceMeters(target, cent) < 15;
      });
      if (plotBuildings.length === 0) plotBuildings = [nearestBuilding];
    }

    const buildingDetails: { area: number; levels: number | null; type: string | null }[] = [];
    let totalFootprint = 0;
    let totalGross = 0;
    let hasLevelData = false;

    for (const building of plotBuildings) {
      const tags = building.tags || {};
      const bLevels = parseInt(tags["building:levels"]) || null;
      const roofLevels = parseInt(tags["roof:levels"]) || 0;
      const totalLevels = bLevels ? bLevels + roofLevels : null;
      if (totalLevels) hasLevelData = true;

      let bArea = 0;
      if (building.nodes && building.nodes.length > 2) {
        const coords = building.nodes
          .map((id: number) => nodeMap.get(id))
          .filter(Boolean) as { lat: number; lon: number }[];
        if (coords.length > 2) {
          bArea = Math.round(calculatePolygonArea(coords));
        }
      }

      if (bArea > 0) {
        totalFootprint += bArea;
        const effectiveLevels = totalLevels || (bArea > 100 ? 2 : 1);
        totalGross += bArea * effectiveLevels;
      }

      buildingDetails.push({
        area: bArea,
        levels: totalLevels,
        type: tags.building || null,
      });
    }

    const footprintArea = totalFootprint > 0 ? totalFootprint : null;
    const levelsWithData = buildingDetails.filter(b => b.levels !== null);
    const levels = levelsWithData.length > 0
      ? Math.round(levelsWithData.reduce((s, b) => s + (b.levels || 0), 0) / levelsWithData.length)
      : null;
    const estimatedGrossArea = totalGross > 0 ? Math.round(totalGross) : null;

    const isMFH = plotBuildings.some((b: { tags?: Record<string, string> }) =>
      b.tags?.building === "apartments" || b.tags?.building === "residential"
    ) || (levels !== null && levels >= 3) || (footprintArea !== null && footprintArea > 200) || plotBuildings.length >= 2;

    const confidence: "high" | "medium" | "low" =
      (footprintArea && hasLevelData) ? "high" :
      footprintArea ? "medium" : "low";

    return {
      footprintArea,
      levels,
      estimatedGrossArea,
      buildingType: nearestBuilding.tags?.building || null,
      isMFH,
      confidence,
      buildingCount: plotBuildings.length,
      buildings: buildingDetails,
      nearbyBusinesses: [],
    };
  } catch {
    return null;
  }
}

/** Fetch nearby businesses/POIs via Overpass API */
export async function fetchNearbyBusinesses(lat: number, lng: number): Promise<NearbyBusiness[]> {
  const radius = 80;
  const query = `[out:json][timeout:10];
(
  node["shop"](around:${radius},${lat},${lng});
  node["office"](around:${radius},${lat},${lng});
  node["amenity"~"restaurant|cafe|bar|pharmacy|bank|doctors|dentist|veterinary|hairdresser"](around:${radius},${lat},${lng});
  node["craft"](around:${radius},${lat},${lng});
  way["shop"](around:${radius},${lat},${lng});
  way["office"](around:${radius},${lat},${lng});
  way["amenity"~"restaurant|cafe|bar|pharmacy|bank|doctors|dentist|veterinary|hairdresser"](around:${radius},${lat},${lng});
);
out body;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pois = data.elements?.filter((e: { tags?: Record<string, string> }) => e.tags?.name) || [];
    return pois.map((poi: { tags?: Record<string, string>; lat?: number; lon?: number }) => {
      const tags = poi.tags || {};
      const poiLat = poi.lat || 0;
      const poiLon = poi.lon || 0;
      const dist = Math.round(Math.sqrt(Math.pow((poiLat - lat) * 111320, 2) + Math.pow((poiLon - lng) * 111320 * Math.cos(lat * Math.PI / 180), 2)));
      const type = tags.shop || tags.office || tags.amenity || tags.craft || "Geschäft";
      return {
        name: tags.name || "Unbekannt",
        type,
        phone: tags.phone || tags["contact:phone"] || null,
        website: tags.website || tags["contact:website"] || null,
        email: tags.email || tags["contact:email"] || null,
        distance: dist,
        address: tags["addr:street"] ? `${tags["addr:street"]} ${tags["addr:housenumber"] || ""}`.trim() : null,
        opening_hours: tags.opening_hours || null,
      };
    }).sort((a: NearbyBusiness, b: NearbyBusiness) => a.distance - b.distance);
  } catch {
    return [];
  }
}

/** Geocode address to lat/lng via Nominatim (for WGH-Scout). Returns null if not found. Optional signal to cancel. */
export async function geocodeToCoord(query: string, signal?: AbortSignal): Promise<{ lat: number; lng: number; display_name: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de`;
  const res = await fetch(url, { headers: { "User-Agent": "ImmoControl/1.0" }, ...(signal && { signal }) });
  if (!res.ok) return null;
  const raw = await res.json();
  const data = parseNominatimResponse(Array.isArray(raw) ? raw : []);
  if (data.length === 0) return null;
  const item = data[0];
  const lat = typeof item.lat === "string" ? parseFloat(item.lat) : (item.lat ?? 0);
  const lon = typeof item.lon === "string" ? parseFloat(item.lon) : (item.lon ?? 0);
  return { lat, lng: lon, display_name: item.display_name ?? "" };
}

/** Bounding box from Nominatim (south, north, west, east). For "whole city" search. */
export interface PlaceBbox {
  south: number;
  north: number;
  west: number;
  east: number;
  display_name: string;
}

export async function geocodePlaceToBbox(query: string, signal?: AbortSignal): Promise<PlaceBbox | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de`;
  const res = await fetch(url, { headers: { "User-Agent": "ImmoControl/1.0" }, ...(signal && { signal }) });
  if (!res.ok) return null;
  const raw = await res.json();
  const arr = Array.isArray(raw) ? raw : [];
  const item = arr[0];
  if (!item || !item.boundingbox || !Array.isArray(item.boundingbox) || item.boundingbox.length < 4) {
    const parsed = parseNominatimResponse(arr);
    if (parsed.length === 0) return null;
    const lat = typeof parsed[0].lat === "string" ? parseFloat(parsed[0].lat) : (parsed[0].lat ?? 0);
    const lon = typeof parsed[0].lon === "string" ? parseFloat(parsed[0].lon) : (parsed[0].lon ?? 0);
    const delta = 0.01;
    return { south: lat - delta, north: lat + delta, west: lon - delta, east: lon + delta, display_name: parsed[0].display_name ?? "" };
  }
  const [south, north, west, east] = item.boundingbox.map((v: string | number) => typeof v === "string" ? parseFloat(v) : v);
  return { south, north, west, east, display_name: item.display_name ?? "" };
}

/** Building with centroid and estimated gross area (for matching to POIs). */
export interface BuildingWithSize {
  lat: number;
  lon: number;
  estimatedGrossArea: number;
  footprintArea: number;
}

type OverpassBuilding = {
  type: string;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  center?: { lat: number; lon: number };
  lat?: number;
  lon?: number;
};

/** Geschossanzahl aus OSM-Tags: building:levels + roof:levels, sonst building:height/3, sonst Fallback. */
function effectiveLevelsFromTags(tags: Record<string, string> | undefined, fallback: number): number {
  if (!tags) return fallback;
  const bLevels = parseInt(tags["building:levels"], 10);
  const roofLevels = parseInt(tags["roof:levels"], 10) || 0;
  if (!Number.isNaN(bLevels) && bLevels >= 1) {
    return Math.max(1, bLevels + roofLevels);
  }
  const heightStr = tags["building:height"];
  if (heightStr != null && heightStr !== "") {
    const heightM = parseFloat(heightStr.replace(/\s*m?\s*$/i, "").trim());
    if (!Number.isNaN(heightM) && heightM > 0) {
      return Math.max(1, Math.round(heightM / 3));
    }
  }
  return fallback;
}

/** Footprint aus Geometrie oder building:area (m²). Liefert 0 wenn nicht ermittelbar. */
function footprintFromElement(el: OverpassBuilding): number {
  const tags = el.tags;
  const areaTag = tags?.["building:area"];
  if (areaTag != null && areaTag !== "") {
    const area = parseFloat(areaTag.replace(/\s*m²?\s*$/i, "").trim());
    if (!Number.isNaN(area) && area >= 20) return Math.round(area);
  }
  const geom = el.geometry;
  const coords = geom && geom.length >= 3 ? geom.map((g) => ({ lat: g.lat, lon: g.lon })) : [];
  if (coords.length < 3) return 0;
  return Math.round(calculatePolygonArea(coords));
}

/** Zentroid aus Geometrie oder center/lat/lon. */
function centroidFromElement(el: OverpassBuilding, coords: { lat: number; lon: number }[]): { lat: number; lon: number } | null {
  if (coords.length >= 3) {
    const sumLat = coords.reduce((s, c) => s + c.lat, 0);
    const sumLon = coords.reduce((s, c) => s + c.lon, 0);
    return { lat: sumLat / coords.length, lon: sumLon / coords.length };
  }
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lon: el.lon };
  return null;
}

/** Fetch buildings in bbox with geometry; return centroid + estimated gross area. Optional signal to cancel. */
export async function fetchBuildingsInBbox(bbox: PlaceBbox, signal?: AbortSignal): Promise<BuildingWithSize[]> {
  const { south, north, west, east } = bbox;
  const query = `[out:json][timeout:${OVERPASS_TIMEOUT_BBOX}];
(
  way["building"](${south},${west},${north},${east});
  relation["building"](${south},${west},${north},${east});
);
out body geom;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      ...(signal && { signal }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const elements = (data.elements ?? []).filter(
      (e: OverpassBuilding) => (e.type === "way" || e.type === "relation") && e.tags?.building
    ) as OverpassBuilding[];
    const result: BuildingWithSize[] = [];
    for (const el of elements) {
      const footprintArea = footprintFromElement(el);
      if (footprintArea < 20) continue;
      const geom = el.geometry;
      const coords = geom && geom.length >= 3 ? geom.map((g) => ({ lat: g.lat, lon: g.lon })) : [];
      const cent = centroidFromElement(el, coords);
      if (!cent) continue;
      const levels = effectiveLevelsFromTags(el.tags, 2);
      result.push({
        lat: cent.lat,
        lon: cent.lon,
        estimatedGrossArea: footprintArea * levels,
        footprintArea,
      });
    }
    return result;
  } catch {
    return [];
  }
}

/** Fetch buildings in radius (for Umkreis mode) with centroid + area. Optional signal to cancel. */
export async function fetchBuildingsInRadius(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<BuildingWithSize[]> {
  const query = `[out:json][timeout:20];
(
  way["building"](around:${radiusM},${lat},${lng});
  relation["building"](around:${radiusM},${lat},${lng});
);
out body geom;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      ...(signal && { signal }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const elements = (data.elements ?? []).filter(
      (e: OverpassBuilding) => (e.type === "way" || e.type === "relation") && e.tags?.building
    ) as OverpassBuilding[];
    const result: BuildingWithSize[] = [];
    for (const el of elements) {
      const footprintArea = footprintFromElement(el);
      if (footprintArea < 20) continue;
      const geom = el.geometry;
      const coords = geom && geom.length >= 3 ? geom.map((g) => ({ lat: g.lat, lon: g.lon })) : [];
      const cent = centroidFromElement(el, coords);
      if (!cent) continue;
      const levels = effectiveLevelsFromTags(el.tags, 2);
      result.push({
        lat: cent.lat,
        lon: cent.lon,
        estimatedGrossArea: footprintArea * levels,
        footprintArea,
      });
    }
    return result;
  } catch {
    return [];
  }
}

/** Commercial POI with lat/lon for matching. */
export interface CommercialPOIWithCoord extends NearbyBusiness {
  lat: number;
  lon: number;
}

/** Fetch commercial POIs in bbox (for whole-place search). Optional signal to cancel. */
export async function fetchCommercialPOIsInBbox(bbox: PlaceBbox, signal?: AbortSignal): Promise<CommercialPOIWithCoord[]> {
  const { south, north, west, east } = bbox;
  const query = `[out:json][timeout:${OVERPASS_TIMEOUT_BBOX}];
(
  node["shop"](${south},${west},${north},${east});
  node["office"](${south},${west},${north},${east});
  node["amenity"~"restaurant|cafe|bar|pharmacy|bank|doctors|dentist|veterinary|hairdresser"](${south},${west},${north},${east});
  node["craft"](${south},${west},${north},${east});
  way["shop"](${south},${west},${north},${east});
  way["office"](${south},${west},${north},${east});
  way["amenity"~"restaurant|cafe|bar|pharmacy|bank|doctors|dentist|veterinary|hairdresser"](${south},${west},${north},${east});
);
out body center;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      ...(signal && { signal }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pois = data.elements?.filter((e: { tags?: Record<string, string> }) => e.tags?.name) || [];
    const centerLat = (bbox.south + bbox.north) / 2;
    const centerLon = (bbox.west + bbox.east) / 2;
    return pois.map((poi: { tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }) => {
      const tags = poi.tags || {};
      const lat = poi.lat ?? poi.center?.lat ?? centerLat;
      const lon = poi.lon ?? poi.center?.lon ?? centerLon;
      const dist = Math.round(distanceMeters({ lat, lon: lon }, { lat: centerLat, lon: centerLon }));
      const type = tags.shop || tags.office || tags.amenity || tags.craft || "Geschäft";
      return {
        name: tags.name || "Unbekannt",
        type,
        phone: tags.phone || tags["contact:phone"] || null,
        website: tags.website || tags["contact:website"] || null,
        email: tags.email || tags["contact:email"] || null,
        distance: dist,
        address: tags["addr:street"] ? `${tags["addr:street"]} ${tags["addr:housenumber"] || ""}`.trim() : (tags["addr:full"] || null),
        opening_hours: tags.opening_hours || null,
        lat,
        lon,
      };
    });
  } catch {
    return [];
  }
}

/** Attach estimated building size to each POI (nearest building within maxDistM). */
export function attachBuildingSizes(
  pois: CommercialPOIWithCoord[],
  buildings: BuildingWithSize[],
  maxDistM = 60
): (CommercialPOIWithCoord & { estimatedGrossArea: number | null })[] {
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

/** Deduplicate POIs by location (same building): round to grid ~50m, keep one with largest estimatedGrossArea per cell. */
export function dedupeScoutResults<T extends { lat: number; lon: number; estimatedGrossArea?: number | null }>(items: T[]): T[] {
  const grid = new Map<string, T>();
  const round = (v: number, step: number) => Math.round(v / step) * step;
  for (const item of items) {
    const key = `${round(item.lat, 0.0005)}_${round(item.lon, 0.0005)}`;
    const existing = grid.get(key);
    const area = item.estimatedGrossArea ?? 0;
    const existingArea = existing?.estimatedGrossArea ?? 0;
    if (!existing || area > existingArea) grid.set(key, item);
  }
  return Array.from(grid.values());
}

/** Fetch commercial POIs in configurable radius (WGH-Scout). Returns POIs with coords for building-size matching. Optional signal to cancel. */
export async function fetchCommercialPOIsInRadius(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<CommercialPOIWithCoord[]> {
  const query = `[out:json][timeout:${OVERPASS_TIMEOUT_RADIUS}];
(
  node["shop"](around:${radiusM},${lat},${lng});
  node["office"](around:${radiusM},${lat},${lng});
  node["amenity"~"restaurant|cafe|bar|pharmacy|bank|doctors|dentist|veterinary|hairdresser"](around:${radiusM},${lat},${lng});
  node["craft"](around:${radiusM},${lat},${lng});
  way["shop"](around:${radiusM},${lat},${lng});
  way["office"](around:${radiusM},${lat},${lng});
  way["amenity"~"restaurant|cafe|bar|pharmacy|bank|doctors|dentist|veterinary|hairdresser"](around:${radiusM},${lat},${lng});
);
out body center;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      ...(signal && { signal }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pois = data.elements?.filter((e: { tags?: Record<string, string> }) => e.tags?.name) || [];
    return pois.map((poi: { tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }) => {
      const tags = poi.tags || {};
      const poiLat = poi.lat ?? poi.center?.lat ?? lat;
      const poiLon = poi.lon ?? poi.center?.lon ?? lng;
      const dist = Math.round(distanceMeters({ lat: poiLat, lon: poiLon }, { lat, lon: lng }));
      const type = tags.shop || tags.office || tags.amenity || tags.craft || "Geschäft";
      return {
        name: tags.name || "Unbekannt",
        type,
        phone: tags.phone || tags["contact:phone"] || null,
        website: tags.website || tags["contact:website"] || null,
        email: tags.email || tags["contact:email"] || null,
        distance: dist,
        address: tags["addr:street"] ? `${tags["addr:street"]} ${tags["addr:housenumber"] || ""}`.trim() : (tags["addr:full"] || null),
        opening_hours: tags.opening_hours || null,
        lat: poiLat,
        lon: poiLon,
      };
    }).sort((a, b) => a.distance - b.distance);
  } catch {
    return [];
  }
}

/* ── CRM display helpers ── */

export function getBuildingSizeLabel(info: BuildingInfo): string {
  if (info.estimatedGrossArea) {
    if (info.estimatedGrossArea > 1000) return "Großes MFH";
    if (info.estimatedGrossArea > 500) return "Mittleres MFH";
    if (info.estimatedGrossArea > 200) return "Kleines MFH";
    return "EFH/ZFH";
  }
  return "Unbekannt";
}

export function getBuildingSizeColor(info: BuildingInfo): string {
  if (!info.estimatedGrossArea) return "text-muted-foreground";
  if (info.estimatedGrossArea > 1000) return "text-green-600 dark:text-green-400";
  if (info.estimatedGrossArea > 500) return "text-blue-600 dark:text-blue-400";
  if (info.estimatedGrossArea > 200) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

export const statusColors: Record<string, string> = {
  neu: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  kontaktiert: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  interessiert: "bg-green-500/10 text-green-700 dark:text-green-400",
  nicht_interessiert: "bg-red-500/10 text-red-700 dark:text-red-400",
  follow_up: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

export const statusLabels: Record<string, string> = {
  neu: "Neu",
  kontaktiert: "Kontaktiert",
  interessiert: "Interessiert",
  nicht_interessiert: "Nicht interessiert",
  follow_up: "Follow-up",
};

export const outcomeLabels: Record<string, string> = {
  kein_ergebnis: "Kein Ergebnis",
  positiv: "Positiv",
  negativ: "Negativ",
  follow_up: "Follow-up",
  voicemail: "Voicemail",
};

/** Maps MobileCRMCallAction outcome to crm_call_logs outcome */
export const mapMobileOutcomeToCrm: Record<string, string> = {
  reached: "positiv",
  voicemail: "voicemail",
  no_answer: "kein_ergebnis",
  busy: "kein_ergebnis",
  follow_up: "follow_up",
};

/* FUNC-39: Lead scoring helper */
interface LeadScoreInput {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  notes?: string | null;
  call_logs?: unknown[];
  status?: string;
}
export const calculateLeadScore = (lead: LeadScoreInput): number => {
  let score = 0;
  if (lead.phone) score += 20;
  if (lead.email) score += 15;
  if (lead.website) score += 10;
  if (lead.notes) score += 10;
  const callCount = lead.call_logs?.length || 0;
  score += Math.min(callCount * 10, 30);
  if (lead.status === "interessiert" || lead.status === "interested") score += 15;
  return Math.min(score, 100);
};

/* FUNC-40: Lead status options */
export const LEAD_STATUS_OPTIONS = [
  { value: "neu", label: "Neu", color: "bg-blue-500" },
  { value: "kontaktiert", label: "Kontaktiert", color: "bg-yellow-500" },
  { value: "interessiert", label: "Interessiert", color: "bg-green-500" },
  { value: "nicht_interessiert", label: "Kein Interesse", color: "bg-red-500" },
  { value: "follow_up", label: "Nachfassen", color: "bg-orange-500" },
] as const;

/* FUNC-41: CRM statistics helper */
export const calcCRMStats = (leads: { status?: string }[]) => ({
  total: leads.length,
  contacted: leads.filter(l => l.status === "kontaktiert").length,
  interested: leads.filter(l => l.status === "interessiert").length,
  conversionRate: leads.length > 0 ? Math.round(leads.filter(l => l.status === "interessiert").length / leads.length * 100) : 0,
});

/* OPT-24: Debounce delay constant */
export const CRM_SEARCH_DEBOUNCE = 400;
