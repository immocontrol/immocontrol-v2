/**
 * CRM utility functions extracted from CRM.tsx for better modularity.
 * Contains geo/building estimation, Nominatim search, and CRM helpers.
 */

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
  const data = await res.json();
  return data.map((item: { place_id: number; display_name: string; lat: string; lon: string; address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string; suburb?: string } }) => {
    const addr = item.address;
    let displayName: string;
    if (addr?.road) {
      displayName = addr.house_number ? `${addr.road} ${addr.house_number}` : addr.road;
      const locality = addr.city || addr.town || addr.village || addr.suburb;
      if (locality) displayName += `, ${locality}`;
    } else {
      const parts = item.display_name.split(",").map(s => s.trim());
      displayName = parts.slice(0, 2).join(", ");
    }
    return {
      place_id: `nominatim-${item.place_id}`,
      name: displayName,
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      phone: null,
      website: null,
      rating: null,
      open_now: null,
      source: "nominatim" as const,
      buildingInfo: null,
    };
  });
}

/** Nominatim autocomplete (debounced) */
export async function searchNominatimAutocomplete(query: string): Promise<{ display_name: string; place_id: number }[]> {
  if (query.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=de&accept-language=de`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "ImmoControl/1.0" } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/* ── OSM Overpass API: building size estimation ── */

export async function estimateBuildingSize(lat: number, lng: number): Promise<BuildingInfo | null> {
  const radius = 20;
  const query = `[out:json][timeout:15];
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
  if (lead.status === "interested") score += 15;
  return Math.min(score, 100);
};

/* FUNC-40: Lead status options */
export const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "Neu", color: "bg-blue-500" },
  { value: "contacted", label: "Kontaktiert", color: "bg-yellow-500" },
  { value: "interested", label: "Interessiert", color: "bg-green-500" },
  { value: "not_interested", label: "Kein Interesse", color: "bg-red-500" },
  { value: "follow_up", label: "Nachfassen", color: "bg-orange-500" },
] as const;

/* FUNC-41: CRM statistics helper */
export const calcCRMStats = (leads: { status?: string }[]) => ({
  total: leads.length,
  contacted: leads.filter(l => l.status === "contacted").length,
  interested: leads.filter(l => l.status === "interested").length,
  conversionRate: leads.length > 0 ? Math.round(leads.filter(l => l.status === "interested").length / leads.length * 100) : 0,
});

/* OPT-24: Debounce delay constant */
export const CRM_SEARCH_DEBOUNCE = 400;
