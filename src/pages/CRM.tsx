import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Phone, MapPin, Globe, Star, Clock, MessageSquare, ExternalLink, Loader2, Building2, Ruler, AlertTriangle, Info, Store, Mail, Edit2, Save, History, Handshake, CalendarCheck, Mic, FileText, Sparkles, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type SearchPlace, type BuildingInfo, type NearbyBusiness,
  searchNominatim, searchNominatimAutocomplete, estimateBuildingSize, fetchNearbyBusinesses,
  getBuildingSizeLabel, getBuildingSizeColor,
  statusColors, statusLabels, outcomeLabels, mapMobileOutcomeToCrm,
  calculateLeadScore, LEAD_STATUS_OPTIONS, calcCRMStats, CRM_SEARCH_DEBOUNCE,
} from "@/lib/crmUtils";
import { CallButton } from "@/components/CallButton";
import { MobileCRMCallAction } from "@/components/mobile/MobileCRMCallAction";
import { EmptyState } from "@/components/EmptyState";
import GewerbeScout from "@/components/GewerbeScout";
import { ColdOutreachTemplates } from "@/components/ColdOutreachTemplates";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import { ROUTES } from "@/lib/routes";
import { summarizeCallTranscript, isDeepSeekConfigured, suggestLeadNextStep } from "@/integrations/ai/extractors";
import { CRMSkeleton } from "@/components/mobile/MobileAllPageSkeletons";

/* IMP-3: Utility functions extracted to @/lib/crmUtils.ts for modularity */

const CRM_TAB_VALUES = ["search", "scout", "leads"] as const;
type CRMTabValue = (typeof CRM_TAB_VALUES)[number];

const CRM = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const tabFromUrl = searchParams.get("tab");
  const crmTab: CRMTabValue = CRM_TAB_VALUES.includes(tabFromUrl as CRMTabValue) ? (tabFromUrl as CRMTabValue) : "search";
  const setCrmTab = useCallback((value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "search") next.delete("tab");
      else next.set("tab", value);
      return next;
    });
  }, [setSearchParams]);
  const [searchQuery, setSearchQuery] = useState("");
  const [placesResults, setPlacesResults] = useState<SearchPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ outcome: "kein_ergebnis", notes: "", duration_minutes: 5, recording_url: "", transcript: "" });
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogForm, setEditLogForm] = useState({ notes: "", outcome: "" });
  const [summarizingLogId, setSummarizingLogId] = useState<string | null>(null);
  const [transcribingLogId, setTranscribingLogId] = useState<string | null>(null);
  const [leadNextStepLoading, setLeadNextStepLoading] = useState(false);
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
  const lastPlaceRef = useRef<SearchPlace | null>(null);
  const lastEditCallLogRef = useRef<{ id: string; notes: string; outcome: string } | null>(null);

  useEffect(() => { document.title = "CRM & Akquise - ImmoControl"; }, []);

  /* Deep-link: ?lead=id from GlobalSearch — select lead when URL has lead param */
  const leadFromUrl = searchParams.get("lead");
  useEffect(() => {
    if (leadFromUrl) setSelectedLead(leadFromUrl);
  }, [leadFromUrl]);

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

  /* FUND-3: Cleanup autocomplete timer on unmount to prevent memory leak */
  useEffect(() => {
    return () => { if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current); };
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

  /* STRONG-12: Use centralised queryKeys instead of inline string arrays — ensures consistent cache invalidation */
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: queryKeys.crm.leads(user?.id),
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

  /* STRONG-12: Use centralised queryKeys for call logs */
  const { data: callLogs = [] } = useQuery({
    queryKey: queryKeys.crm.callLogs(selectedLead ?? undefined),
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
      handleError(err, { context: "network", showToast: false });
      const msg = "Fehler bei der Suche: " + (err instanceof Error ? err.message : "Unbekannt");
      toastErrorWithRetry(msg, () => searchPlaces());
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
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads(user?.id) });
      toast.success("Lead gespeichert");
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "crm_leads.insert (place)", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message : "Fehler beim Speichern", () => { if (lastPlaceRef.current) savePlaceLead.mutate(lastPlaceRef.current); });
    },
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
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads(user?.id) });
      toast.success("Lead angelegt");
      setAddDialogOpen(false);
      setAddForm({ name: "", company: "", phone: "", email: "", address: "", category: "geschaeft", notes: "" });
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "crm_leads.insert (manual)", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message : "Fehler beim Anlegen", () => addManualLead.mutate());
    },
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
        recording_url: logForm.recording_url?.trim() || null,
        transcript: logForm.transcript?.trim() || null,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.callLogs(selectedLead ?? undefined) });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads(user?.id) });
      toast.success("Gespräch geloggt");
      setLogDialogOpen(false);
      setLogForm({ outcome: "kein_ergebnis", notes: "", duration_minutes: 5, recording_url: "", transcript: "" });
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "crm_call_logs.insert", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message : "Fehler beim Loggen", () => logCall.mutate());
    },
  });

  // Save call log from MobileCRMCallAction (post-call dialog)
  const saveCallLogFromMobile = useMutation({
    mutationFn: async ({ log, leadId }: { log: { outcome: string; notes: string; duration: number; startedAt: string }; leadId: string }) => {
      const crmOutcome = mapMobileOutcomeToCrm[log.outcome] ?? "kein_ergebnis";
      const durationMinutes = Math.max(1, Math.round(log.duration / 60));
      const { error } = await supabase.from("crm_call_logs").insert({
        user_id: user!.id,
        lead_id: leadId,
        outcome: crmOutcome,
        notes: log.notes.trim() || null,
        duration_minutes: durationMinutes,
        call_date: log.startedAt,
      });
      if (error) throw error;
      const statusMap: Record<string, string> = {
        positiv: "interessiert",
        negativ: "nicht_interessiert",
        follow_up: "follow_up",
        kein_ergebnis: "kontaktiert",
        voicemail: "kontaktiert",
      };
      await supabase.from("crm_leads").update({ status: statusMap[crmOutcome] || "kontaktiert" }).eq("id", leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.callLogs(selectedLead ?? undefined) });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads(user?.id) });
      toast.success("Gespräch geloggt");
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "crm_call_logs.insert (mobile)", showToast: true });
    },
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
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.callLogs(selectedLead ?? undefined) });
      toast.success("Gesprächsnotiz aktualisiert");
      setEditingLogId(null);
      setEditLogForm({ notes: "", outcome: "" });
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "crm_call_logs.update", showToast: false });
      toastErrorWithRetry(e instanceof Error ? e.message : "Fehler beim Aktualisieren", () => { if (lastEditCallLogRef.current) editCallLog.mutate(lastEditCallLogRef.current); });
    },
  });

  // Update call log transcript / transcript_summary (z. B. nach Transkription oder KI-Zusammenfassung)
  const updateCallLogTranscript = useMutation({
    mutationFn: async ({ id, transcript, transcript_summary }: { id: string; transcript?: string | null; transcript_summary?: string | null }) => {
      const updates: { transcript?: string | null; transcript_summary?: string | null } = {};
      if (transcript !== undefined) updates.transcript = transcript;
      if (transcript_summary !== undefined) updates.transcript_summary = transcript_summary;
      const { error } = await supabase.from("crm_call_logs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.callLogs(selectedLead ?? undefined) });
      toast.success("Aktualisiert");
      setSummarizingLogId(null);
      setTranscribingLogId(null);
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "crm_call_logs.update", showToast: true });
      setSummarizingLogId(null);
      setTranscribingLogId(null);
    },
  });

  const handleSummarizeLog = useCallback(async (log: { id: string; transcript?: string | null }) => {
    if (!log.transcript?.trim()) return;
    setSummarizingLogId(log.id);
    try {
      const summary = await summarizeCallTranscript(log.transcript);
      if (summary) updateCallLogTranscript.mutate({ id: log.id, transcript_summary: summary });
      else toast.error("Zusammenfassung konnte nicht erstellt werden.");
    } catch (e) {
      handleError(e, { context: "ai", details: "summarizeCallTranscript", showToast: true });
      setSummarizingLogId(null);
    }
  }, [updateCallLogTranscript]);

  const handleTranscribeLog = useCallback(async (log: { id: string; recording_url?: string | null }) => {
    if (!log.recording_url?.trim()) return;
    setTranscribingLogId(log.id);
    try {
      const { data, error } = await supabase.functions.invoke("call-transcribe", {
        body: { recording_url: log.recording_url, call_log_id: log.id },
      });
      if (error) throw error;
      if (data?.transcript != null) {
        updateCallLogTranscript.mutate({ id: log.id, transcript: data.transcript });
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        toast.error("Transkription fehlgeschlagen.");
      }
    } catch (e) {
      handleError(e, { context: "functions", details: "call-transcribe", showToast: true });
      setTranscribingLogId(null);
    }
  }, [updateCallLogTranscript]);

  // Update lead status
  const updateLeadStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("crm_leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm_leads"] }),
  });

  /* FUND-2: Memoize filtered leads to avoid recalculation on unrelated state changes */
  const filteredLeads = useMemo(() => filterStatus === "all" ? leads : leads.filter((l: { status: string }) => l.status === filterStatus), [leads, filterStatus]);
  const selectedLeadData = useMemo(() => leads.find((l: { id: string }) => l.id === selectedLead), [leads, selectedLead]);

  const exportLeadsCsv = useCallback(() => {
    if (filteredLeads.length === 0) {
      toast.info("Keine Leads zum Exportieren");
      return;
    }
    const headers = ["Name", "Firma", "Telefon", "E-Mail", "Adresse", "Status", "Notizen", "Aktualisiert"];
    const escape = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = (filteredLeads as Array<{ name: string; company?: string | null; phone?: string | null; email?: string | null; address?: string | null; status: string; notes?: string | null; updated_at?: string }>).map((l) => [
      l.name ?? "",
      l.company ?? "",
      l.phone ?? "",
      l.email ?? "",
      l.address ?? "",
      statusLabels[l.status] ?? l.status,
      (l.notes ?? "").replace(/\n/g, " "),
      l.updated_at ? new Date(l.updated_at).toLocaleString("de-DE") : "",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.map(String).map(escape).join(";"))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Leads exportiert");
  }, [filteredLeads]);

  /* FUNC-13: Lead scoring automation — compute a score for each lead (0..100) */
  const leadScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of leads as Array<{ id: string } & Record<string, unknown>>) {
      map.set(lead.id, calculateLeadScore(lead));
    }
    return map;
  }, [leads]);

  const scoredFilteredLeads = useMemo(() => {
    const list = (filteredLeads as Array<{ id: string } & Record<string, unknown>>).map((lead) => ({
      ...lead,
      score: leadScores.get(lead.id) ?? 0,
    }));
    list.sort((a, b) => (b.score as number) - (a.score as number));
    return list;
  }, [filteredLeads, leadScores]);

  const selectedLeadScore = selectedLeadData ? (leadScores.get((selectedLeadData as { id: string }).id) ?? 0) : 0;

  const scoreBadgeClass = (score: number): string => {
    if (score >= 80) return "bg-red-500/10 text-red-700 dark:text-red-400";
    if (score >= 60) return "bg-orange-500/10 text-orange-700 dark:text-orange-400";
    if (score >= 40) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    return "bg-muted text-muted-foreground";
  };

  /* FUND-2: Wrap leadStats in useMemo — previously recalculated 4x filter() on every render */
  const leadStats = useMemo(() => ({
    total: leads.length,
    neu: leads.filter((l: { status: string }) => l.status === "neu").length,
    kontaktiert: leads.filter((l: { status: string }) => l.status === "kontaktiert").length,
    interessiert: leads.filter((l: { status: string }) => l.status === "interessiert").length,
  }), [leads]);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight break-words">CRM & Akquise</h1>
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

      <Tabs value={crmTab} onValueChange={setCrmTab} className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="search" className="flex-1 sm:flex-none nav-label-responsive">Suche & Akquise</TabsTrigger>
          <TabsTrigger value="scout" className="flex-1 sm:flex-none nav-label-responsive">WGH-Scout</TabsTrigger>
          <TabsTrigger value="leads" className="flex-1 sm:flex-none nav-label-responsive">Meine Leads ({leads.length})</TabsTrigger>
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
              {/* MOBILE-FIX: prevent overlap on small screens */}
              <div className="flex flex-col sm:flex-row gap-2">
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <Ruler className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
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
                            <SelectTrigger className="h-7 w-full sm:w-[120px] text-xs">
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
                  <span className="text-xs text-muted-foreground sm:whitespace-nowrap">
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
                            <CallButton phone={place.phone} toLabel={place.name} className="text-xs text-primary hover:underline flex items-center gap-1" variant="link" />
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
                                            <CallButton phone={biz.phone} toLabel={biz.name} className="text-primary hover:underline flex items-center gap-0.5" variant="link" />
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
                          <CallButton phone={place.phone} toLabel={place.name} className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-accent" ariaLabel={`Anrufen: ${place.name}`}>
                            <Phone className="h-3.5 w-3.5" />
                          </CallButton>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => { lastPlaceRef.current = place; savePlaceLead.mutate(place); }}
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

        {/* WGH-Scout Tab: Wohn- und Geschäftshäuser finden, anrufen, als Lead übernehmen */}
        <TabsContent value="scout" className="space-y-4">
          <WidgetErrorBoundary name="WGH-Scout">
            <GewerbeScout
              initialQuery={searchParams.get("q") ?? undefined}
              onAddAsLead={(b) => {
                setAddForm((prev) => ({ ...prev, name: b.name, address: b.address || "", phone: b.phone || "" }));
                setAddDialogOpen(true);
              }}
              onAddAsDeal={(b) => navigate(ROUTES.DEALS, { state: { fromScout: { name: b.name, address: b.address ?? undefined, phone: b.phone ?? undefined, email: b.email ?? undefined } } })}
              onAddAsViewing={(b) => navigate(ROUTES.BESICHTIGUNGEN, { state: { fromScout: { title: b.name, address: b.address ?? "" } } })}
            />
          </WidgetErrorBoundary>
          <ColdOutreachTemplates />
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
            <Button variant="outline" size="sm" className="shrink-0 gap-1 ml-auto" onClick={exportLeadsCsv} disabled={filteredLeads.length === 0} aria-label="Leads als CSV exportieren">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>

          {/* ANIM-1: Add card-stagger-enter animation to CRM leads grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 card-stagger-enter">
            {/* Lead list */}
            <div className="lg:col-span-1 space-y-2 max-h-[50vh] lg:max-h-[70vh] overflow-y-auto custom-scrollbar">
              {leadsLoading ? (
                <CRMSkeleton />
              ) : filteredLeads.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck}
                  title="Keine Leads gefunden"
                  description="Suche nach Geschäften oder füge Leads manuell hinzu."
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.CRM_SCOUT)} className="touch-target min-h-[44px] gap-1.5" aria-label="Zum WGH-Scout">
                        <Store className="h-4 w-4" /> WGH suchen
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.BESICHTIGUNGEN)} className="touch-target min-h-[44px] gap-1.5">
                        <CalendarCheck className="h-4 w-4" /> Zu Besichtigungen
                      </Button>
                    </div>
                  }
                />
              ) : (
                scoredFilteredLeads.map((lead: { id: string; name: string; company?: string; phone?: string; status: string; updated_at?: string; score: number }) => (
                  <Card
                    key={lead.id}
                    className={cn("cursor-pointer transition-all hover:shadow-md", selectedLead === lead.id && "ring-2 ring-primary")}
                    onClick={() => setSelectedLead(lead.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate" title={lead.name}>{lead.name}</p>
                          {lead.company && <p className="text-xs text-muted-foreground truncate" title={lead.company}>{lead.company}</p>}
                          {lead.phone && (
                            <div className="flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                              <CallButton phone={lead.phone} toLabel={lead.name} leadId={lead.id} record className="text-xs text-primary hover:underline flex items-center gap-0.5 shrink-0" variant="link" ariaLabel={`${lead.name} anrufen`}>
                                <Phone className="h-3 w-3" /> <span className="truncate" title={lead.phone}>{lead.phone}</span>
                              </CallButton>
                            </div>
                          )}
                          {lead.updated_at && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Zuletzt: {new Date(lead.updated_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge className={cn("text-[10px]", statusColors[lead.status] || "")}>
                            {statusLabels[lead.status] || lead.status}
                          </Badge>
                          <Badge className={cn("text-[10px]", scoreBadgeClass(lead.score))}>
                            Score {lead.score}
                          </Badge>
                        </div>
                        {/* status badge moved into column */}
                        <span className="sr-only">
                          {statusLabels[lead.status] || lead.status}
                        </span>
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
                        <Badge className={cn("text-[10px]", scoreBadgeClass(selectedLeadScore))}>
                          Score {selectedLeadScore}
                        </Badge>
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
                          <MobileCRMCallAction
                            phoneNumber={selectedLeadData.phone}
                            contactName={selectedLeadData.name}
                            leadId={selectedLeadData.id}
                            onSaveLog={(log) => {
                              if (selectedLead) {
                                saveCallLogFromMobile.mutate({
                                  log: {
                                    outcome: log.outcome,
                                    notes: log.notes,
                                    duration: log.duration,
                                    startedAt: log.startedAt,
                                  },
                                  leadId: selectedLead,
                                });
                              }
                            }}
                            className="h-8 px-2.5 gap-1.5 shrink-0"
                          />
                        )}
                        <Button size="sm" variant="outline" onClick={() => { setLogDialogOpen(true); setLogForm({ outcome: "kein_ergebnis", notes: "", duration_minutes: 5, recording_url: "", transcript: "" }); }}>
                          <MessageSquare className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Gespräch</span> loggen
                        </Button>
                        {isDeepSeekConfigured() && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                disabled={leadNextStepLoading}
                                onClick={async () => {
                                  setLeadNextStepLoading(true);
                                  try {
                                    const step = await suggestLeadNextStep(selectedLeadData);
                                    if (step) toast.info(step, { duration: 6000 });
                                  } catch (e) {
                                    handleError(e, { context: "ai", details: "suggestLeadNextStep", showToast: true });
                                  } finally {
                                    setLeadNextStepLoading(false);
                                  }
                                }}
                                aria-label="KI: Nächster Schritt vorschlagen"
                              >
                                {leadNextStepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                <span className="hidden sm:inline">KI</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Nächsten Schritt vorschlagen lassen</TooltipContent>
                          </Tooltip>
                        )}
                        <Button size="sm" variant="default" onClick={() => navigate(ROUTES.DEALS, { state: { fromLead: selectedLeadData } })} className="touch-target min-h-[44px]">
                          <Handshake className="h-4 w-4 mr-1" /> Als Deal
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {selectedLeadData.phone && (
                        <div>
                          <span className="text-muted-foreground text-xs">Telefon</span>
                          <p><CallButton phone={selectedLeadData.phone} toLabel={selectedLeadData.name} className="text-primary hover:underline" variant="link" /></p>
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
                          {callLogs.map((log: { id: string; outcome: string; call_date: string; duration_minutes: number; notes?: string; recording_url?: string | null; transcript?: string | null; transcript_summary?: string | null }) => (
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
                                      <Button size="sm" className="h-6 text-xs" onClick={() => { const payload = { id: log.id, notes: editLogForm.notes, outcome: editLogForm.outcome }; lastEditCallLogRef.current = payload; editCallLog.mutate(payload); }}>
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
                                    {(log.recording_url || log.transcript || log.transcript_summary) && (
                                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                        {log.recording_url && (
                                          <a
                                            href={log.recording_url}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                            aria-label="Aufzeichnung abspielen"
                                          >
                                            <Mic className="h-3 w-3" /> Aufzeichnung
                                          </a>
                                        )}
                                        {log.recording_url && !log.transcript && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs gap-1"
                                            disabled={transcribingLogId === log.id}
                                            onClick={() => handleTranscribeLog(log)}
                                          >
                                            {transcribingLogId === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                                            {transcribingLogId === log.id ? "Wird erstellt…" : "Transkript erstellen"}
                                          </Button>
                                        )}
                                        {log.transcript && (
                                          <details className="group">
                                            <summary className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground list-none">
                                              <FileText className="h-3 w-3" /> Transkript
                                            </summary>
                                            <p className="text-xs text-muted-foreground whitespace-pre-line mt-1 pl-4 border-l-2 border-border text-wrap-safe">{log.transcript}</p>
                                          </details>
                                        )}
                                        {log.transcript && !log.transcript_summary && isDeepSeekConfigured() && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs gap-1"
                                            disabled={summarizingLogId === log.id}
                                            onClick={() => handleSummarizeLog(log)}
                                          >
                                            {summarizingLogId === log.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                            {summarizingLogId === log.id ? "Wird erstellt…" : "KI zusammenfassen"}
                                          </Button>
                                        )}
                                        {log.transcript_summary && (
                                          <details className="group">
                                            <summary className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground list-none">
                                              <Sparkles className="h-3 w-3" /> Zusammenfassung
                                            </summary>
                                            <p className="text-xs text-muted-foreground whitespace-pre-line mt-1 pl-4 border-l-2 border-primary/30 text-wrap-safe">{log.transcript_summary}</p>
                                          </details>
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
          <DialogHeader>
            <DialogTitle>Gespräch loggen</DialogTitle>
            <p className="text-xs text-muted-foreground font-normal">Einwilligung zur Aufzeichnung holst du selbst ein – keine System-Ansage.</p>
          </DialogHeader>
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
            <Textarea placeholder="Gesprächsnotizen..." value={logForm.notes} onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Aufzeichnung (optional)</Label>
              <Input
                type="url"
                placeholder="https://… (Link zur Aufnahme)"
                value={logForm.recording_url}
                onChange={e => setLogForm(p => ({ ...p, recording_url: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Transkript (optional)</Label>
              <Textarea
                placeholder="Transkript einfügen oder später ergänzen…"
                value={logForm.transcript}
                onChange={e => setLogForm(p => ({ ...p, transcript: e.target.value }))}
                rows={3}
                className="text-sm resize-y min-h-[60px]"
              />
            </div>
            <Button onClick={() => logCall.mutate()} className="w-full">Gespräch speichern</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* FUNC-39..41 + OPT-24: Now imported from @/lib/crmUtils */

export default CRM;
