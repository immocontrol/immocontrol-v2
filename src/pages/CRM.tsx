import { useState, useCallback, useEffect } from "react";
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
import { Search, Plus, Phone, MapPin, Globe, Star, Clock, MessageSquare, ExternalLink, Loader2, Building2, Ruler, AlertTriangle, Info } from "lucide-react";
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

interface BuildingInfo {
  footprintArea: number | null;
  levels: number | null;
  estimatedGrossArea: number | null;
  buildingType: string | null;
  isMFH: boolean;
  confidence: "high" | "medium" | "low";
}

// Nominatim search (free, no API key needed)
async function searchNominatim(query: string): Promise<SearchPlace[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=10&countrycodes=de&accept-language=de`;
  const res = await fetch(url, {
    headers: { "User-Agent": "ImmoControl/1.0" },
  });
  if (!res.ok) throw new Error("Nominatim-Suche fehlgeschlagen");
  const data = await res.json();
  return data.map((item: { place_id: number; display_name: string; lat: string; lon: string }) => ({
    place_id: `nominatim-${item.place_id}`,
    name: item.display_name.split(",")[0] || item.display_name,
    address: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    phone: null,
    website: null,
    rating: null,
    open_now: null,
    source: "nominatim" as const,
    buildingInfo: null,
  }));
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

// OSM Overpass API: estimate building size near a coordinate
async function estimateBuildingSize(lat: number, lng: number): Promise<BuildingInfo | null> {
  const radius = 30;
  const query = `[out:json][timeout:10];(way["building"](around:${radius},${lat},${lng});relation["building"](around:${radius},${lat},${lng}););out body;>;out skel qt;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const buildings = data.elements?.filter((e: { type: string; tags?: Record<string, string> }) =>
      (e.type === "way" || e.type === "relation") && e.tags?.building
    ) || [];
    if (buildings.length === 0) return null;
    const building = buildings[0];
    const tags = building.tags || {};
    const levels = parseInt(tags["building:levels"]) || null;
    const roofLevels = parseInt(tags["roof:levels"]) || 0;
    const totalLevels = levels ? levels + roofLevels : null;
    const nodes = data.elements?.filter((e: { type: string }) => e.type === "node") || [];
    const nodeMap = new Map<number, { lat: number; lon: number }>();
    nodes.forEach((n: { id: number; lat: number; lon: number }) => nodeMap.set(n.id, { lat: n.lat, lon: n.lon }));
    let footprintArea: number | null = null;
    if (building.nodes && building.nodes.length > 2) {
      const coords = building.nodes
        .map((id: number) => nodeMap.get(id))
        .filter(Boolean) as { lat: number; lon: number }[];
      if (coords.length > 2) {
        footprintArea = Math.round(calculatePolygonArea(coords));
      }
    }
    const buildingType = tags.building;
    const isMFH = buildingType === "apartments" || buildingType === "residential" ||
                   (totalLevels !== null && totalLevels >= 3) ||
                   (footprintArea !== null && footprintArea > 200);
    const estimatedGrossArea = footprintArea && totalLevels
      ? Math.round(footprintArea * totalLevels)
      : footprintArea
        ? Math.round(footprintArea * (isMFH ? 4 : 2))
        : null;
    const confidence: "high" | "medium" | "low" =
      (footprintArea && totalLevels) ? "high" :
      footprintArea ? "medium" : "low";
    return { footprintArea, levels: totalLevels, estimatedGrossArea, buildingType: tags.building || null, isMFH, confidence };
  } catch {
    return null;
  }
}

function getBuildingSizeLabel(info: BuildingInfo): string {
  if (info.estimatedGrossArea) {
    if (info.estimatedGrossArea > 1000) return "Grosses MFH";
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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", company: "", phone: "", email: "", address: "", category: "geschaeft", notes: "" });
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchSource, setSearchSource] = useState<"auto" | "nominatim">("auto");
  const [minBuildingSize, setMinBuildingSize] = useState<number>(0);
  const [estimatingBuildings, setEstimatingBuildings] = useState(false);

  useEffect(() => { document.title = "CRM & Akquise - ImmoControl"; }, []);

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
  const searchPlaces = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setPlacesLoading(true);
    setPlacesResults([]);
    try {
      if (searchSource === "auto") {
        try {
          const { data, error } = await supabase.functions.invoke("google-places-search", {
            body: { query: searchQuery },
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
      const places = await searchNominatim(searchQuery);
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

  // Estimate building sizes for all search results
  const estimateBuildingSizes = useCallback(async () => {
    if (placesResults.length === 0) return;
    setEstimatingBuildings(true);
    const updatedResults = [...placesResults];
    let estimated = 0;
    for (let i = 0; i < updatedResults.length; i++) {
      const place = updatedResults[i];
      if (place.lat && place.lng && !place.buildingInfo) {
        const info = await estimateBuildingSize(place.lat, place.lng);
        if (info) {
          updatedResults[i] = { ...place, buildingInfo: info };
          estimated++;
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
          ? `Geschätzte Gebäudefläche: ~${place.buildingInfo.estimatedGrossArea || "?"}m² | ${getBuildingSizeLabel(place.buildingInfo)} | Stockwerke: ${place.buildingInfo.levels || "?"} | Grundfläche: ${place.buildingInfo.footprintArea || "?"}m²`
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
        <TabsList>
          <TabsTrigger value="search">Suche & Akquise</TabsTrigger>
          <TabsTrigger value="leads">Meine Leads ({leads.length})</TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Geschäfte & Eigentümer finden
                </CardTitle>
                <Select value={searchSource} onValueChange={(v: string) => setSearchSource(v as "auto" | "nominatim")}>
                  <SelectTrigger className="h-7 w-[160px] text-xs">
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
                <Input
                  placeholder="z.B. 'Bäckerei Friedrichstraße Berlin' oder 'Mehrfamilienhaus München'"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchPlaces()}
                  className="flex-1"
                />
                <Button onClick={searchPlaces} disabled={placesLoading || !searchQuery.trim()}>
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
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] gap-1", getBuildingSizeColor(place.buildingInfo))}
                            >
                              <Ruler className="h-2.5 w-2.5" />
                              {getBuildingSizeLabel(place.buildingInfo)}
                              {place.buildingInfo.estimatedGrossArea && ` (~${place.buildingInfo.estimatedGrossArea}m²)`}
                            </Badge>
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
                                <TooltipContent className="text-xs">
                                  {place.buildingInfo.confidence === "medium"
                                    ? "Stockwerkanzahl geschätzt"
                                    : "Grobe Schätzung - wenig OSM-Daten verfügbar"}
                                </TooltipContent>
                              </Tooltip>
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
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant={filterStatus === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterStatus("all")}>
              Alle ({leads.length})
            </Button>
            {Object.entries(statusLabels).map(([key, label]) => {
              const count = leads.filter((l: { status: string }) => l.status === key).length;
              return (
                <Button key={key} variant={filterStatus === key ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(key)}>
                  {label} ({count})
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Lead list */}
            <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto">
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
                      <div className="flex items-center gap-2">
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
                          <MessageSquare className="h-4 w-4 mr-1" /> Gespräch loggen
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
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
                            <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/50 text-sm">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">{outcomeLabels[log.outcome] || log.outcome}</Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(log.call_date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  {log.duration_minutes > 0 && (
                                    <span className="text-[10px] text-muted-foreground">{log.duration_minutes} Min.</span>
                                  )}
                                </div>
                                {log.notes && <p className="text-xs mt-1 text-muted-foreground">{log.notes}</p>}
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

export default CRM;
