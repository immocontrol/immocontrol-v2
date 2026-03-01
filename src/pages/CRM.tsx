import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Phone, MapPin, Globe, Star, Clock, MessageSquare, ExternalLink, Loader2, Building2, Ruler, AlertTriangle, Info, Store, Mail, Edit2, Save, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SearchPlace {
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

interface NearbyBusiness {
  name: string;
  type: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  distance: number;
  address: string | null;
  opening_hours: string | null;
}

interface BuildingInfo {
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

// Nominatim search (free, no API key needed)
async function searchNominatim(query: string): Promise<SearchPlace[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=10&countrycodes=de&accept-language=de`;
  const res = await fetch(url, {
    headers: { "User-Agent": "ImmoControl/1.0" },
  });
  if (!res.ok) throw new Error("Nominatim-Suche fehlgeschlagen");
  const data = await res.json();
  return data.map((item: { place_id: number; display_name: string; lat: string; lon: string; address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string; suburb?: string } }) => {
    // Build a proper name: street + house number, or first two parts of display_name
    const addr = item.address;
    let displayName: string;
    if (addr?.road) {
      displayName = addr.house_number ? `${addr.road} ${addr.house_number}` : addr.road;
      const locality = addr.city || addr.town || addr.village || addr.suburb;
      if (locality) displayName += `, ${locality}`;
    } else {
      // Fallback: take first 2 parts of display_name for a reasonable title
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

// Shoelace formula for polygon area in m2 (from lat/lng coordinates)
function calculatePolygonArea(coords: { lat: number; lon: number }[]): number {
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

// Helper: calculate centroid of a building's nodes
function buildingCentroid(nodeIds: number[], nodeMap: Map<number, { lat: number; lon: number }>): { lat: number; lon: number } | null {
  const coords = nodeIds.map(id => nodeMap.get(id)).filter(Boolean) as { lat: number; lon: number }[];
  if (coords.length === 0) return null;
  const sumLat = coords.reduce((s, c) => s + c.lat, 0);
  const sumLon = coords.reduce((s, c) => s + c.lon, 0);
  return { lat: sumLat / coords.length, lon: sumLon / coords.length };
}

// Helper: distance between two lat/lon points in meters
function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dlat = (b.lat - a.lat) * 111320;
  const dlon = (b.lon - a.lon) * 111320 * Math.cos(a.lat * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

// OSM Overpass API: estimate building size — finds the nearest building, then includes
// all buildings sharing the same street address (same Flurstück/plot)
async function estimateBuildingSize(lat: number, lng: number): Promise<BuildingInfo | null> {
  // Step 1: Small radius (20m) to find the building at the exact address
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

    // Find the nearest building to the search coordinate
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

    // Step 2: Filter to only buildings sharing the same address (street + housenumber)
    const refTags = nearestBuilding.tags || {};
    const refStreet = refTags["addr:street"] || "";
    const refNumber = refTags["addr:housenumber"] || "";
    let plotBuildings;
    if (refStreet && refNumber) {
      // If the nearest building has address tags, match all buildings with same address
      plotBuildings = allBuildings.filter((b: { tags?: Record<string, string> }) => {
        const t = b.tags || {};
        return (t["addr:street"] === refStreet && t["addr:housenumber"] === refNumber);
      });
      // Also include buildings without address tags that are very close (< 15m)
      // to capture garages, Remise etc. that often lack address tags
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
      // No address tags on nearest building — use only buildings within 15m of search point
      plotBuildings = allBuildings.filter((b: { nodes?: number[] }) => {
        if (!b.nodes) return false;
        const cent = buildingCentroid(b.nodes, nodeMap);
        return cent && distanceMeters(target, cent) < 15;
      });
      if (plotBuildings.length === 0) plotBuildings = [nearestBuilding];
    }

    // Step 3: Calculate area & levels for EACH building individually
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
        // Use INDIVIDUAL floor count per building, not a shared max
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
    // Show individual building levels in detail, but use weighted average for summary
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

// Fetch nearby businesses/POIs via Overpass API
async function fetchNearbyBusinesses(lat: number, lng: number): Promise<NearbyBusiness[]> {
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

// Nominatim autocomplete (debounced)
async function searchNominatimAutocomplete(query: string): Promise<{ display_name: string; place_id: number }[]> {
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

function getBuildingSizeLabel(info: BuildingInfo): string {
  if (info.estimatedGrossArea) {
    if (info.estimatedGrossArea > 1000) return "Großes MFH";
    if (info.estimatedGrossArea > 500) return "Mittleres MFH";
    if (info.estimatedGrossArea > 200) return "Kleines MFH";
    return "EFH/ZFH";
  }
  return "Unbekannt";
}

function getBuildingSizeColor(info: BuildingInfo): string {
  if (!info.estimatedGrossArea) return "text-muted-foreground";
  if (info.estimatedGrossArea > 1000) return "text-green-600 dark:text-green-400";
  if (info.estimatedGrossArea > 500) return "text-blue-600 dark:text-blue-400";
  if (info.estimatedGrossArea > 200) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

const statusColors: Record<string, string> = {
  neu: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  kontaktiert: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  interessiert: "bg-green-500/10 text-green-700 dark:text-green-400",
  nicht_interessiert: "bg-red-500/10 text-red-700 dark:text-red-400",
  follow_up: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

const statusLabels: Record<string, string> = {
  neu: "Neu",
  kontaktiert: "Kontaktiert",
  interessiert: "Interessiert",
  nicht_interessiert: "Nicht interessiert",
  follow_up: "Follow-up",
};

const outcomeLabels: Record<string, string> = {
  kein_ergebnis: "Kein Ergebnis",
  positiv: "Positiv",
  negativ: "Negativ",
  follow_up: "Follow-up",
  voicemail: "Voicemail",
};

const CRM = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [placesResults, setPlacesResults] = useState<SearchPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ outcome: "kein_ergebnis", notes: "", duration_minutes: 5 });
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogForm, setEditLogForm] = useState({ notes: "", outcome: "" });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", company: "", phone: "", email: "", address: "", category: "geschaeft", notes: "" });
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchSource, setSearchSource] = useState<"auto" | "nominatim">("auto");
  const [minBuildingSize, setMinBuildingSize] = useState<number>(0);
  const [estimatingBuildings, setEstimatingBuildings] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<{ display_name: string; place_id: number }[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = "CRM & Akquise - ImmoControl"; }, []);

  // Debounced autocomplete
  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (value.length < 3) {
      setAutocompleteSuggestions([]);
      setShowAutocomplete(false);
      return;
    }
    autocompleteTimer.current = setTimeout(async () => {
      const results = await searchNominatimAutocomplete(value);
      setAutocompleteSuggestions(results);
      setShowAutocomplete(results.length > 0);
    }, 400);
  }, []);

  // Close autocomplete on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.parentElement?.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch leads
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["crm_leads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch call logs for selected lead
  const { data: callLogs = [] } = useQuery({
    queryKey: ["crm_call_logs", selectedLead],
    queryFn: async () => {
      if (!selectedLead) return [];
      const { data, error } = await supabase
        .from("crm_call_logs")
        .select("*")
        .eq("lead_id", selectedLead)
        .order("call_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLead,
  });

  // Search with fallback: Google Places -> Nominatim
  const searchPlaces = useCallback(async (queryOverride?: string) => {
    const query = queryOverride ?? searchQuery;
    if (!query.trim()) return;
    setPlacesLoading(true);
    setPlacesResults([]);
    try {
      if (searchSource === "auto") {
        try {
          const { data, error } = await supabase.functions.invoke("google-places-search", {
            body: { query },
          });
          if (error) throw error;
          const places: SearchPlace[] = (data.places || []).map((p: SearchPlace) => ({ ...p, source: "google" as const }));
          if (places.length > 0) {
            setPlacesResults(places);
            toast.success(`${places.length} Ergebnisse via Google Places`);
            return;
          }
        } catch {
          toast.info("Google Places nicht verfügbar - nutze OpenStreetMap als Alternative");
        }
      }
      const places = await searchNominatim(query);
      setPlacesResults(places);
      if (places.length > 0) {
        toast.success(`${places.length} Ergebnisse via OpenStreetMap`);
      } else {
        toast.info("Keine Ergebnisse gefunden");
      }
    } catch (err: unknown) {
      toast.error("Fehler bei der Suche: " + (err instanceof Error ? err.message : "Unbekannt"));
    } finally {
      setPlacesLoading(false);
    }
  }, [searchQuery, searchSource]);

  // Estimate building sizes + fetch nearby businesses for all search results
  const estimateBuildingSizes = useCallback(async () => {
    if (placesResults.length === 0) return;
    setEstimatingBuildings(true);
    const updatedResults = [...placesResults];
    let estimated = 0;
    for (let i = 0; i < updatedResults.length; i++) {
      const place = updatedResults[i];
      if (place.lat && place.lng && !place.buildingInfo) {
        // Fetch building info and nearby businesses in parallel
        const [info, businesses] = await Promise.all([
          estimateBuildingSize(place.lat, place.lng),
          fetchNearbyBusinesses(place.lat, place.lng),
        ]);
        if (info) {
          info.nearbyBusinesses = businesses;
          updatedResults[i] = { ...place, buildingInfo: info };
          estimated++;
        } else if (businesses.length > 0) {
          updatedResults[i] = {
            ...place,
            buildingInfo: {
              footprintArea: null, levels: null, estimatedGrossArea: null,
              buildingType: null, isMFH: false, confidence: "low",
              buildingCount: 0, buildings: [], nearbyBusinesses: businesses,
            },
          };
        }
        if (i < updatedResults.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    setPlacesResults(updatedResults);
    setEstimatingBuildings(false);
    toast.success(`${estimated} Gebäude analysiert`);
  }, [placesResults]);

  // Filter results by minimum building size
  const filteredPlacesResults = minBuildingSize > 0
    ? placesResults.filter(p =>
        p.buildingInfo?.estimatedGrossArea && p.buildingInfo.estimatedGrossArea >= minBuildingSize
      )
    : placesResults;

  // Save lead from Places
  const savePlaceLead = useMutation({
    mutationFn: async (place: SearchPlace) => {
      const { error } = await supabase.from("crm_leads").insert({
        user_id: user!.id,
        name: place.name,
        address: place.address,
        phone: place.phone || "",
        google_place_id: place.place_id,
        lat: place.lat,
        lng: place.lng,
        category: "geschaeft",
        notes: place.buildingInfo
          ? `Geschätzte Gebäudefläche: ~${place.buildingInfo.estimatedGrossArea || "?"}m² | ${getBuildingSizeLabel(place.buildingInfo)} | Stockwerke: ${place.buildingInfo.levels || "?"} | Grundfläche: ${place.buildingInfo.footprintArea || "?"}m² | ${place.buildingInfo.buildingCount} Gebäude${place.buildingInfo.nearbyBusinesses.length > 0 ? " | Geschäfte: " + place.buildingInfo.nearbyBusinesses.map(b => b.name).join(", ") : ""}`
          : "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_leads"] });
      toast.success("Lead gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Add manual lead
  const addManualLead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_leads").insert({
        user_id: user!.id,
        ...addForm,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_leads"] });
      toast.success("Lead angelegt");
      setAddDialogOpen(false);
      setAddForm({ name: "", company: "", phone: "", email: "", address: "", category: "geschaeft", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Log a call
  const logCall = useMutation({
    mutationFn: async () => {
      if (!selectedLead) return;
      const { error } = await supabase.from("crm_call_logs").insert({
        user_id: user!.id,
        lead_id: selectedLead,
        outcome: logForm.outcome,
        notes: logForm.notes,
        duration_minutes: logForm.duration_minutes,
      });
      if (error) throw error;
      // Update lead status based on outcome
      const statusMap: Record<string, string> = {
        positiv: "interessiert",
        negativ: "nicht_interessiert",
        follow_up: "follow_up",
        kein_ergebnis: "kontaktiert",
        voicemail: "kontaktiert",
      };
      await supabase.from("crm_leads").update({ status: statusMap[logForm.outcome] || "kontaktiert" }).eq("id", selectedLead);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_call_logs"] });
      queryClient.invalidateQueries({ queryKey: ["crm_leads"] });
      toast.success("Gespräch geloggt");
      setLogDialogOpen(false);
      setLogForm({ outcome: "kein_ergebnis", notes: "", duration_minutes: 5 });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Edit a call log entry
  const editCallLog = useMutation({
    mutationFn: async ({ id, notes, outcome }: { id: string; notes: string; outcome: string }) => {
      // Append edit history to notes
      const originalLog = callLogs.find((l: { id: string }) => l.id === id);
      const editTimestamp = new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
      const historyEntry = `\n--- Bearbeitet am ${editTimestamp} ---`;
      const oldNotes = originalLog?.notes || "";
      const updatedNotes = oldNotes !== notes
        ? `${notes}${historyEntry}\nVorher: ${oldNotes}`
        : notes;
      const { error } = await supabase.from("crm_call_logs").update({
        notes: updatedNotes,
        outcome,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm_call_logs"] });
      toast.success("Gesprächsnotiz aktualisiert");
      setEditingLogId(null);
      setEditLogForm({ notes: "", outcome: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update lead status
  const updateLeadStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("crm_leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm_leads"] }),
  });

  const filteredLeads = filterStatus === "all" ? leads : leads.filter((l: { status: string }) => l.status === filterStatus);
  const selectedLeadData = leads.find((l: { id: string }) => l.id === selectedLead);

  // Lead stats
  const leadStats = {
    total: leads.length,
    neu: leads.filter((l: { status: string }) => l.status === "neu").length,
    kontaktiert: leads.filter((l: { status: string }) => l.status === "kontaktiert").length,
    interessiert: leads.filter((l: { status: string }) => l.status === "interessiert").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM & Akquise</h1>
          <p className="text-muted-foreground text-sm">
            Leads finden, kontaktieren & nachverfolgen
            {leadStats.total > 0 && (
              <span className="ml-2">
                · {leadStats.neu} neu · {leadStats.kontaktiert} kontaktiert · {leadStats.interessiert} interessiert
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{leads.length} Leads</Badge>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Lead anlegen</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuen Lead anlegen</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Name *" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Firma" value={addForm.company} onChange={e => setAddForm(p => ({ ...p, company: e.target.value }))} />
                <Input placeholder="Telefon" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} />
                <Input placeholder="E-Mail" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} />
                <Input placeholder="Adresse" value={addForm.address} onChange={e => setAddForm(p => ({ ...p, address: e.target.value }))} />
                <Textarea placeholder="Notizen" value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))} />
                <Button onClick={() => addManualLead.mutate()} disabled={!addForm.name.trim()} className="w-full">
                  Speichern
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="search" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="search" className="flex-1 sm:flex-none">Suche & Akquise</TabsTrigger>
          <TabsTrigger value="leads" className="flex-1 sm:flex-none">Meine Leads ({leads.length})</TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Geschäfte & Eigentümer finden
                </CardTitle>
                <Select value={searchSource} onValueChange={(v: string) => setSearchSource(v as "auto" | "nominatim")}>
                  <SelectTrigger className="h-7 w-full sm:w-[160px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Google + OSM)</SelectItem>
                    <SelectItem value="nominatim">Nur OpenStreetMap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    ref={searchInputRef}
                    placeholder="z.B. 'Eisenbahnstraße 73 Eberswalde' oder 'Bäckerei Berlin'"
                    value={searchQuery}
                    onChange={e => handleSearchInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        setShowAutocomplete(false);
                        searchPlaces();
                      }
                    }}
                    onFocus={() => autocompleteSuggestions.length > 0 && setShowAutocomplete(true)}
                  />
                  {/* Autocomplete dropdown */}
                  {showAutocomplete && autocompleteSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {autocompleteSuggestions.map((s) => (
                        <button
                          key={s.place_id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors flex items-center gap-2 border-b border-border/30 last:border-0"
                          onClick={() => {
                            const selectedQuery = s.display_name.split(",")[0] + ", " + (s.display_name.split(",").slice(1, 3).join(",").trim());
                            setSearchQuery(selectedQuery);
                            setShowAutocomplete(false);
                            // Auto-search with the selected query directly to avoid stale closure
                            searchPlaces(selectedQuery);
                          }}
                        >
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{s.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={() => { setShowAutocomplete(false); searchPlaces(); }} disabled={placesLoading || !searchQuery.trim()}>
                  {placesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {/* Building size estimation controls */}
              {placesResults.length > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <Ruler className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={estimateBuildingSizes}
                        disabled={estimatingBuildings}
                      >
                        {estimatingBuildings ? <Loader2 className="h-3 w-3 animate-spin" /> : <Building2 className="h-3 w-3" />}
                        Gebäudegrößen schätzen
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px] text-xs">
                          Nutzt OpenStreetMap-Gebäudedaten (Grundfläche x Stockwerke) um die ungefähre Größe zu schätzen.
                          Größere MFH (&gt;500m²) sind für Investoren interessanter.
                        </TooltipContent>
                      </Tooltip>
                      {placesResults.some(p => p.buildingInfo) && (
                        <>
                          <span className="text-xs text-muted-foreground">Min. Fläche:</span>
                          <Select value={String(minBuildingSize)} onValueChange={v => setMinBuildingSize(Number(v))}>
                            <SelectTrigger className="h-7 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Alle</SelectItem>
                              <SelectItem value="200">200+ m²</SelectItem>
                              <SelectItem value="500">500+ m²</SelectItem>
                              <SelectItem value="1000">1000+ m²</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {filteredPlacesResults.length} von {placesResults.length} Ergebnis{placesResults.length !== 1 ? "sen" : ""}
                  </span>
                </div>
              )}

              {filteredPlacesResults.length > 0 && (
                <div className="space-y-2">
                  {filteredPlacesResults.map(place => (
                    <div key={place.place_id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                      <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{place.name}</span>
                          {place.source === "nominatim" && (
                            <Badge variant="outline" className="text-[10px]">OSM</Badge>
                          )}
                          {place.rating && (
                            <span className="flex items-center gap-0.5 text-xs text-yellow-600">
                              <Star className="h-3 w-3 fill-yellow-500" /> {place.rating}
                            </span>
                          )}
                          {place.open_now !== null && (
                            <Badge variant="outline" className={cn("text-[10px]", place.open_now ? "text-green-600" : "text-red-500")}>
                              {place.open_now ? "Geöffnet" : "Geschlossen"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {place.phone && (
                            <a href={`tel:${place.phone}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {place.phone}
                            </a>
                          )}
                          {place.website && (
                            <a href={place.website} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                              <Globe className="h-3 w-3" /> Website
                            </a>
                          )}
                          <a
                            href={`https://maps.google.com/?q=${place.lat},${place.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Maps
                          </a>
                        </div>
                        {/* Building size info */}
                        {place.buildingInfo && (
                          <div className="mt-1.5 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] gap-1", getBuildingSizeColor(place.buildingInfo))}
                              >
                                <Ruler className="h-2.5 w-2.5" />
                                {getBuildingSizeLabel(place.buildingInfo)}
                                {place.buildingInfo.estimatedGrossArea && ` (~${place.buildingInfo.estimatedGrossArea}m²)`}
                              </Badge>
                              {place.buildingInfo.buildingCount > 1 && (
                                <Badge variant="outline" className="text-[10px] gap-1 text-blue-600 dark:text-blue-400">
                                  <Building2 className="h-2.5 w-2.5" />
                                  {place.buildingInfo.buildingCount} Gebäude
                                </Badge>
                              )}
                              {place.buildingInfo.levels && (
                                <span className="text-[10px] text-muted-foreground">
                                  {place.buildingInfo.levels} Stockwerke
                                </span>
                              )}
                              {place.buildingInfo.footprintArea && (
                                <span className="text-[10px] text-muted-foreground">
                                  Grundfläche: {place.buildingInfo.footprintArea}m²
                                </span>
                              )}
                              {place.buildingInfo.confidence !== "high" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3 w-3 text-yellow-500 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs max-w-[300px]">
                                    {place.buildingInfo.confidence === "medium"
                                      ? "Stockwerkanzahl geschätzt"
                                      : "Grobe Schätzung - wenig OSM-Daten verfügbar"}
                                    {place.buildingInfo.buildingCount > 1 && (
                                      <span className="block mt-1">
                                        Einzelgebäude: {place.buildingInfo.buildings.filter(b => b.area > 0).map((b, i) =>
                                          `#${i + 1}: ${b.area}m²${b.levels ? ` (${b.levels}St.)` : ""}`
                                        ).join(" · ")}
                                      </span>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            {/* Nearby businesses */}
                            {place.buildingInfo.nearbyBusinesses.length > 0 && (
                              <div className="pl-0.5">
                                <div className="flex items-center gap-1 mb-1">
                                  <Store className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    {place.buildingInfo.nearbyBusinesses.length} Geschäfte in der Nähe
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {place.buildingInfo.nearbyBusinesses.slice(0, 8).map((biz, idx) => (
                                    <div key={idx} className="flex items-start gap-2 p-1.5 rounded bg-secondary/30 text-[11px]">
                                      <Store className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-medium">{biz.name}</span>
                                          <span className="text-muted-foreground capitalize">{biz.type}</span>
                                          <span className="text-muted-foreground">{biz.distance}m</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                          {biz.phone && (
                                            <a href={`tel:${biz.phone}`} className="text-primary hover:underline flex items-center gap-0.5">
                                              <Phone className="h-2.5 w-2.5" /> {biz.phone}
                                            </a>
                                          )}
                                          {biz.email && (
                                            <a href={`mailto:${biz.email}`} className="text-primary hover:underline flex items-center gap-0.5">
                                              <Mail className="h-2.5 w-2.5" /> {biz.email}
                                            </a>
                                          )}
                                          {biz.website && (
                                            <a href={biz.website} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary flex items-center gap-0.5">
                                              <Globe className="h-2.5 w-2.5" /> Web
                                            </a>
                                          )}
                                          {biz.opening_hours && (
                                            <span className="text-muted-foreground flex items-center gap-0.5">
                                              <Clock className="h-2.5 w-2.5" /> {biz.opening_hours}
                                            </span>
                                          )}
                                        </div>
                                        {biz.address && (
                                          <span className="text-muted-foreground text-[10px]">{biz.address}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {place.buildingInfo.nearbyBusinesses.length > 8 && (
                                    <p className="text-[10px] text-muted-foreground pl-5">
                                      +{place.buildingInfo.nearbyBusinesses.length - 8} weitere Geschäfte
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {place.phone && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={`tel:${place.phone}`}><Phone className="h-3.5 w-3.5" /></a>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => savePlaceLead.mutate(place)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Speichern
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!placesLoading && placesResults.length === 0 && searchQuery.trim() && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Drücke Enter oder klicke Suchen um Ergebnisse zu laden</p>
                  <p className="text-xs mt-1">Suche nach Adressen, Straßen oder Geschäftstypen in Deutschland</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap overflow-x-auto scrollbar-hide pb-1">
            <Button variant={filterStatus === "all" ? "default" : "outline"} size="sm" className="shrink-0" onClick={() => setFilterStatus("all")}>
              Alle ({leads.length})
            </Button>
            {Object.entries(statusLabels).map(([key, label]) => {
              const count = leads.filter((l: { status: string }) => l.status === key).length;
              return (
                <Button key={key} variant={filterStatus === key ? "default" : "outline"} size="sm" className="shrink-0" onClick={() => setFilterStatus(key)}>
                  {label} ({count})
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Lead list */}
            <div className="lg:col-span-1 space-y-2 max-h-[50vh] lg:max-h-[70vh] overflow-y-auto custom-scrollbar">
              {leadsLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Laden...</div>
              ) : filteredLeads.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Keine Leads gefunden</CardContent></Card>
              ) : (
                filteredLeads.map((lead: { id: string; name: string; company?: string; phone?: string; status: string; updated_at?: string }) => (
                  <Card
                    key={lead.id}
                    className={cn("cursor-pointer transition-all hover:shadow-md", selectedLead === lead.id && "ring-2 ring-primary")}
                    onClick={() => setSelectedLead(lead.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{lead.name}</p>
                          {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
                          {lead.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" /> {lead.phone}
                            </p>
                          )}
                          {lead.updated_at && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Zuletzt: {new Date(lead.updated_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            </p>
                          )}
                        </div>
                        <Badge className={cn("text-[10px] shrink-0", statusColors[lead.status] || "")}>
                          {statusLabels[lead.status] || lead.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Lead detail */}
            <div className="lg:col-span-2">
              {selectedLeadData ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{selectedLeadData.name}</CardTitle>
                        {selectedLeadData.company && <p className="text-sm text-muted-foreground">{selectedLeadData.company}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select
                          value={selectedLeadData.status}
                          onValueChange={v => updateLeadStatus.mutate({ id: selectedLeadData.id, status: v })}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedLeadData.phone && (
                          <Button size="sm" asChild>
                            <a href={`tel:${selectedLeadData.phone}`}><Phone className="h-4 w-4 mr-1" /> Anrufen</a>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => { setLogDialogOpen(true); setLogForm({ outcome: "kein_ergebnis", notes: "", duration_minutes: 5 }); }}>
                          <MessageSquare className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Gespräch</span> loggen
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {selectedLeadData.phone && (
                        <div>
                          <span className="text-muted-foreground text-xs">Telefon</span>
                          <p><a href={`tel:${selectedLeadData.phone}`} className="text-primary hover:underline">{selectedLeadData.phone}</a></p>
                        </div>
                      )}
                      {selectedLeadData.email && (
                        <div>
                          <span className="text-muted-foreground text-xs">E-Mail</span>
                          <p><a href={`mailto:${selectedLeadData.email}`} className="text-primary hover:underline">{selectedLeadData.email}</a></p>
                        </div>
                      )}
                      {selectedLeadData.address && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground text-xs">Adresse</span>
                          <p className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {selectedLeadData.address}
                            <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedLeadData.address)}`} target="_blank" rel="noreferrer" className="ml-1">
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </a>
                          </p>
                        </div>
                      )}
                      {selectedLeadData.notes && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground text-xs">Notizen</span>
                          <p>{selectedLeadData.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Call log history */}
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Clock className="h-4 w-4" /> Gesprächsverlauf
                      </h3>
                      {callLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">Noch keine Gespräche geloggt</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {callLogs.map((log: { id: string; outcome: string; call_date: string; duration_minutes: number; notes?: string }) => (
                            <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/50 text-sm group">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                {editingLogId === log.id ? (
                                  <div className="space-y-2">
                                    <Select value={editLogForm.outcome} onValueChange={v => setEditLogForm(p => ({ ...p, outcome: v }))}>
                                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(outcomeLabels).map(([k, v]) => (
                                          <SelectItem key={k} value={k}>{v}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Textarea
                                      value={editLogForm.notes}
                                      onChange={e => setEditLogForm(p => ({ ...p, notes: e.target.value }))}
                                      rows={3}
                                      className="text-xs"
                                      placeholder="Notizen bearbeiten..."
                                    />
                                    <div className="flex gap-1">
                                      <Button size="sm" className="h-6 text-xs" onClick={() => editCallLog.mutate({ id: log.id, notes: editLogForm.notes, outcome: editLogForm.outcome })}>
                                        <Save className="h-3 w-3 mr-1" /> Speichern
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingLogId(null)}>
                                        Abbrechen
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[10px]">{outcomeLabels[log.outcome] || log.outcome}</Badge>
                                      <span className="text-[10px] text-muted-foreground">
                                        {new Date(log.call_date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                      {log.duration_minutes > 0 && (
                                        <span className="text-[10px] text-muted-foreground">{log.duration_minutes} Min.</span>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity ml-auto"
                                        onClick={() => {
                                          setEditingLogId(log.id);
                                          // Strip edit history from displayed notes for editing
                                          const rawNotes = log.notes || "";
                                          const historyIdx = rawNotes.indexOf("\n--- Bearbeitet am");
                                          setEditLogForm({
                                            notes: historyIdx > -1 ? rawNotes.substring(0, historyIdx) : rawNotes,
                                            outcome: log.outcome,
                                          });
                                        }}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    {log.notes && (
                                      <div className="mt-1">
                                        {log.notes.includes("--- Bearbeitet am") ? (
                                          <>
                                            <p className="text-xs text-muted-foreground whitespace-pre-line">
                                              {log.notes.substring(0, log.notes.indexOf("\n--- Bearbeitet am"))}
                                            </p>
                                            <details className="mt-1">
                                              <summary className="text-[10px] text-muted-foreground/60 cursor-pointer flex items-center gap-1">
                                                <History className="h-2.5 w-2.5" /> Bearbeitungsverlauf
                                              </summary>
                                              <p className="text-[10px] text-muted-foreground/50 whitespace-pre-line mt-0.5">
                                                {log.notes.substring(log.notes.indexOf("\n--- Bearbeitet am"))}
                                              </p>
                                            </details>
                                          </>
                                        ) : (
                                          <p className="text-xs text-muted-foreground whitespace-pre-line">{log.notes}</p>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center text-sm text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    Wähle einen Lead aus der Liste
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Log Call Dialog */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gespräch loggen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={logForm.outcome} onValueChange={v => setLogForm(p => ({ ...p, outcome: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(outcomeLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Dauer (Min.)" value={logForm.duration_minutes} onChange={e => setLogForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))} />
            <Textarea placeholder="Gesprächsnotizen..." value={logForm.notes} onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} rows={4} />
            <Button onClick={() => logCall.mutate()} className="w-full">Gespräch speichern</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* FUNC-39: Lead scoring helper */
const calculateLeadScore = (lead: any): number => {
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
const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "Neu", color: "bg-blue-500" },
  { value: "contacted", label: "Kontaktiert", color: "bg-yellow-500" },
  { value: "interested", label: "Interessiert", color: "bg-green-500" },
  { value: "not_interested", label: "Kein Interesse", color: "bg-red-500" },
  { value: "follow_up", label: "Nachfassen", color: "bg-orange-500" },
] as const;

/* FUNC-41: CRM statistics helper */
const calcCRMStats = (leads: any[]) => ({
  total: leads.length,
  contacted: leads.filter(l => l.status === "contacted").length,
  interested: leads.filter(l => l.status === "interested").length,
  conversionRate: leads.length > 0 ? Math.round(leads.filter(l => l.status === "interested").length / leads.length * 100) : 0,
});

/* OPT-24: Debounce delay constant */
const CRM_SEARCH_DEBOUNCE = 400;


export default CRM;
