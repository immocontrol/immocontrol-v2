/**
 * WGH-Scout (Wohn- und Geschäftshaus): Findet Gewerbe/Läden nach Ort oder Umkreis.
 * Nutzt Provider-Abstraktion (aktuell OpenStreetMap; erweiterbar um Google Places, Foursquare, etc.).
 * Ort-Autocomplete, Mindestfläche, Deduplizierung.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MapPin, Phone, Mail, Loader2, Search, Store, ExternalLink, UserPlus, Building2, Info, Download, Sparkles, Map, Globe, RotateCcw, Handshake, CalendarCheck, Copy, Share2, SlidersHorizontal, Repeat, Users, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { searchNominatimAutocomplete } from "@/lib/crmUtils";
import {
  aggregateGeocode,
  aggregateGeocodeToBbox,
  aggregatePOIsByBbox,
  aggregatePOIsByRadius,
  getActiveProviders,
  type ScoutPOI,
  type PlaceBbox,
} from "@/lib/scoutProviders";
import { cn } from "@/lib/utils";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { isDeepSeekConfigured, suggestColdCallOpening, suggestScoutInterest } from "@/integrations/ai/extractors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROUTES } from "@/lib/routes";

type SearchMode = "ort" | "umkreis";

const VALID_RADIUS_VALUES = [200, 500, 1000, 2000, 3000, 5000, 10000] as const;
const RADIUS_OPTIONS = [
  { value: 200, label: "200 m" },
  { value: 500, label: "500 m" },
  { value: 1000, label: "1 km" },
  { value: 2000, label: "2 km" },
  { value: 3000, label: "3 km" },
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
];

/** POI-Typ-Filter: OSM-Werte zu Kategorien. */
const POI_TYPE_CATEGORIES: { value: string; label: string; match: (t: string) => boolean }[] = [
  { value: "all", label: "Alle Typen", match: () => true },
  { value: "gastronomie", label: "Gastronomie", match: (t) => /restaurant|cafe|bar/i.test(t) },
  { value: "laden", label: "Laden", match: (t) => /shop|supermarket|bakery|kiosk|convenience|retail|mall|clothes/i.test(t || "") },
  { value: "buero", label: "Büro", match: (t) => /office/i.test(t) },
  { value: "handwerk", label: "Handwerk", match: (t) => /craft/i.test(t) },
  { value: "sonstige", label: "Sonstige", match: (t) => !/restaurant|cafe|bar|shop|office|craft/i.test(t) },
];

const MIN_SIZE_OPTIONS = [
  { value: 0, label: "Alle" },
  { value: 200, label: "≥ 200 m²" },
  { value: 500, label: "≥ 500 m²" },
  { value: 1000, label: "≥ 1.000 m²" },
  { value: 1500, label: "≥ 1.500 m²" },
  { value: 2000, label: "≥ 2.000 m²" },
  { value: 3000, label: "≥ 3.000 m²" },
  { value: 5000, label: "≥ 5.000 m²" },
];

const MAX_SIZE_OPTIONS = [
  { value: 0, label: "Kein Maximum" },
  { value: 500, label: "≤ 500 m²" },
  { value: 1000, label: "≤ 1.000 m²" },
  { value: 2000, label: "≤ 2.000 m²" },
  { value: 5000, label: "≤ 5.000 m²" },
  { value: 10000, label: "≤ 10.000 m²" },
];

const SCOUT_DISPLAY_CAP = 100;

/** Schwellen für unrealistische Gebäudeflächen (Warnung anzeigen). */
const AREA_WARN_VERY_LARGE_M2 = 25_000;
const AREA_WARN_EXTREME_M2 = 80_000;
const AREA_MAX_RATIO_VS_PARCEL = 15;
const AREA_MIN_RATIO_VS_PARCEL = 0.15;

/**
 * Prüft, ob die angezeigte Fläche unrealistisch oder stark von der Norm abweicht.
 * Gibt eine Warnung zurück, die der User angezeigt bekommt (z. B. „Ungewöhnlich groß – bitte prüfen“).
 */
function getAreaWarning(estimatedGrossArea: number | null | undefined, parcelArea: number | null | undefined): string | null {
  const gross = estimatedGrossArea ?? 0;
  if (gross < 20) return null;
  if (gross >= AREA_WARN_EXTREME_M2) {
    return "Unrealistisch groß – bitte in Maps/Kataster prüfen.";
  }
  if (gross >= AREA_WARN_VERY_LARGE_M2) {
    return "Ungewöhnlich groß – deutliche Abweichung von der Norm, bitte prüfen.";
  }
  const parcel = parcelArea ?? 0;
  if (parcel >= 50) {
    const ratio = gross / parcel;
    if (ratio > AREA_MAX_RATIO_VS_PARCEL) {
      return "Gebäudefläche weicht stark vom Grundstück ab – bitte prüfen.";
    }
    if (ratio < AREA_MIN_RATIO_VS_PARCEL) {
      return "Gebäudefläche deutlich kleiner als Grundstück – ggf. nur Teilfläche.";
    }
  }
  return null;
}

/** Lesbare Namen für CSV und Badge (Quelle). */
const SOURCE_LABELS: Record<string, string> = {
  openstreetmap: "OpenStreetMap",
  google: "Google Places",
  foursquare: "Foursquare",
  here: "HERE",
  mapbox: "Mapbox",
  yelp: "Yelp",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

type SortBy = "size" | "distance" | "name" | "source";
type LoadingStep = "ort" | "gewerbe" | "gebaeude" | null;

/** Ein Treffer im WGH-Scout (kann von OSM, Google, Foursquare etc. kommen). */
export type ScoutResult = ScoutPOI;

const SCOUT_STORAGE_KEY = "gewerbe_scout_last";

/** Liest persistierte Scout-Filter/Suche aus sessionStorage (nur für Initial-State). */
function getScoutStorage(): Record<string, unknown> | null {
  try {
    const s = sessionStorage.getItem(SCOUT_STORAGE_KEY);
    return s ? (JSON.parse(s) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function ScoutAiCallPopover({ business }: { business: ScoutResult }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setText(null);
    try {
      const result = await suggestColdCallOpening(business.name, business.type, business.address);
      setText(result || "Kein Vorschlag erhalten.");
    } catch {
      setText("Fehler beim Generieren.");
    } finally {
      setLoading(false);
    }
  }, [business.name, business.type, business.address]);

  useEffect(() => {
    if (open && text === null && !loading) load();
  }, [open, load, loading, text]);

  const copy = useCallback(() => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("In Zwischenablage kopiert");
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]" aria-label={`KI Anruf-Einstieg: ${business.name}`}>
          <Sparkles className="h-3.5 w-3.5" /> KI Einstieg
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] max-w-[calc(100vw-2rem)] p-3" align="end">
        <p className="text-xs font-medium mb-2">Anruf-Einstieg (KI)</p>
        {loading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Wird generiert…</p>}
        {!loading && text && (
          <>
            <p className="text-sm text-wrap-safe mb-2">{text}</p>
            <Button size="sm" variant="secondary" className="w-full gap-1" onClick={copy}>
              {copied ? "Kopiert!" : "Kopieren"}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ScoutInterestPopover({ business }: { business: ScoutResult }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setText(null);
    try {
      const result = await suggestScoutInterest({
        name: business.name,
        type: business.type,
        address: business.address,
        estimatedGrossArea: business.estimatedGrossArea ?? null,
      });
      setText(result || "Kein Vorschlag erhalten.");
    } catch {
      setText("Fehler beim Generieren.");
    } finally {
      setLoading(false);
    }
  }, [business.name, business.type, business.address, business.estimatedGrossArea]);

  useEffect(() => {
    if (open && text === null && !loading) load();
  }, [open, load, loading, text]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px] text-muted-foreground" aria-label={`Warum interessant: ${business.name}`}>
          <Sparkles className="h-3.5 w-3.5" /> Warum interessant?
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] max-w-[calc(100vw-2rem)] p-3" align="end">
        <p className="text-xs font-medium mb-2">Für Akquise interessant</p>
        {loading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Wird generiert…</p>}
        {!loading && text && <p className="text-sm text-wrap-safe">{text}</p>}
      </PopoverContent>
    </Popover>
  );
}

export interface GewerbeScoutProps {
  onAddAsLead?: (business: { name: string; address: string | null; phone: string | null }) => void;
  /** Als Deal anlegen (navigiert zu Deals mit vorausgefüllten Daten). */
  onAddAsDeal?: (business: { name: string; address: string | null; phone: string | null; email?: string | null }) => void;
  /** Als Besichtigung anlegen (navigiert zu Besichtigungen mit Titel/Adresse vorausgefüllt). */
  onAddAsViewing?: (business: { name: string; address: string | null }) => void;
  /** Vorausgefüllte Suche (z. B. von Deals oder URL ?q=). */
  initialQuery?: string;
}

export default function GewerbeScout({ onAddAsLead, onAddAsDeal, onAddAsViewing, initialQuery }: GewerbeScoutProps) {
  const [query, setQuery] = useState(() => (getScoutStorage()?.query as string) ?? "");
  const [mode, setMode] = useState<SearchMode>(() =>
    getScoutStorage()?.mode === "umkreis" ? "umkreis" : "ort"
  );
  const [radius, setRadius] = useState(() => {
    const p = getScoutStorage();
    const r = Number(p?.radius);
    return VALID_RADIUS_VALUES.includes(r as (typeof VALID_RADIUS_VALUES)[number]) ? r : 500;
  });
  const { startCall } = useVoiceCall();
  const isMobile = useIsMobile();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const validMinSizes = MIN_SIZE_OPTIONS.map((o) => o.value);
  const [minSize, setMinSize] = useState(() => {
    const p = getScoutStorage();
    const v = Number(p?.minSize);
    return validMinSizes.includes(v) ? v : 0;
  });
  const [maxSize, setMaxSize] = useState(() => {
    const p = getScoutStorage();
    const v = Number(p?.maxSize);
    return MAX_SIZE_OPTIONS.some((o) => o.value === v) ? v : 0;
  });
  const [onlyWithPhone, setOnlyWithPhone] = useState(() => !!getScoutStorage()?.onlyWithPhone);
  const [onlyWithWebsite, setOnlyWithWebsite] = useState(() => !!getScoutStorage()?.onlyWithWebsite);
  const [poiTypeFilter, setPoiTypeFilter] = useState(() => {
    const v = getScoutStorage()?.poiTypeFilter as string | undefined;
    return v && POI_TYPE_CATEGORIES.some((c) => c.value === v) ? v : "all";
  });
  const [onlyWithEmail, setOnlyWithEmail] = useState(() => !!getScoutStorage()?.onlyWithEmail);
  const [onlyWithOpeningHours, setOnlyWithOpeningHours] = useState(() => !!getScoutStorage()?.onlyWithOpeningHours);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>(null);
  const [results, setResults] = useState<ScoutResult[]>([]);
  const [searchLabel, setSearchLabel] = useState<string | null>(null);
  const [lastBbox, setLastBbox] = useState<PlaceBbox | null>(null);
  const [lastCenter, setLastCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const v = getScoutStorage()?.sortBy as string | undefined;
    return v === "size" || v === "distance" || v === "name" || v === "source" ? v : "size";
  });
  const [suggestions, setSuggestions] = useState<{ display_name: string; place_id: number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const suggestionRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const resultsListRef = useRef<HTMLUListElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  /* Abort in-flight search on unmount to avoid setState after unmount */
  useEffect(() => () => { searchAbortRef.current?.abort(); }, []);
  /** Roving tabindex: index of the focused result row (keyboard nav). */
  const [focusedResultIndex, setFocusedResultIndex] = useState<number | null>(null);
  const focusedResultRef = useRef<HTMLLIElement | null>(null);
  const prevLoadingRef = useRef(false);

  useEffect(() => {
    if (initialQuery != null && initialQuery.trim()) setQuery(initialQuery.trim());
  }, [initialQuery]);

  const effectiveArea = (r: ScoutResult) => r.estimatedGrossArea ?? r.parcelArea ?? 0;
  const sortedResults = useMemo(() => {
    let list = [...results];
    if (minSize > 0) list = list.filter((r) => effectiveArea(r) >= minSize);
    if (maxSize > 0) list = list.filter((r) => effectiveArea(r) <= maxSize);
    if (onlyWithPhone) list = list.filter((r) => r.phone != null && r.phone.trim() !== "");
    if (onlyWithWebsite) list = list.filter((r) => r.website != null && r.website.trim() !== "");
    if (onlyWithEmail) list = list.filter((r) => r.email != null && r.email.trim() !== "");
    if (onlyWithOpeningHours) list = list.filter((r) => r.opening_hours != null && r.opening_hours.trim() !== "");
    const cat = POI_TYPE_CATEGORIES.find((c) => c.value === poiTypeFilter);
    if (cat && cat.value !== "all") list = list.filter((r) => cat.match(r.type));
    if (sortBy === "size") {
      list.sort((a, b) => effectiveArea(b) - effectiveArea(a));
    } else if (sortBy === "distance") {
      list.sort((a, b) => a.distance - b.distance);
    } else if (sortBy === "source") {
      list.sort((a, b) => (a.source ?? "").localeCompare(b.source ?? "") || a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [results, minSize, maxSize, onlyWithPhone, onlyWithWebsite, onlyWithEmail, onlyWithOpeningHours, poiTypeFilter, sortBy]);

  const resultStats = useMemo(() => {
    const list = sortedResults.slice(0, SCOUT_DISPLAY_CAP);
    return {
      withPhone: list.filter((r) => r.phone != null && r.phone.trim() !== "").length,
      withWeb: list.filter((r) => r.website != null && r.website.trim() !== "").length,
      withEmail: list.filter((r) => r.email != null && r.email.trim() !== "").length,
    };
  }, [sortedResults]);

  /* Reset focused result when results change; scroll focused row into view */
  const visibleResults = useMemo(() => sortedResults.slice(0, SCOUT_DISPLAY_CAP), [sortedResults]);
  useEffect(() => {
    if (visibleResults.length === 0) {
      setFocusedResultIndex(null);
      return;
    }
    setFocusedResultIndex((prev) => (prev === null ? 0 : Math.min(prev, visibleResults.length - 1)));
  }, [visibleResults.length]);
  useEffect(() => {
    focusedResultRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedResultIndex]);

  /* Scroll results into view when search completes */
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;
    if (wasLoading && !loading && results.length > 0) {
      resultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [loading, results.length]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      searchNominatimAutocomplete(query.trim(), ac.signal)
        .then((list) => { if (!ac.signal.aborted) setSuggestions(list); })
        .catch(() => { /* ignore abort */ });
    }, 400);
    return () => { clearTimeout(t); ac.abort(); };
  }, [query]);

  const pickSuggestion = useCallback((display_name: string) => {
    setQuery(display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    setSuggestionIndex(0);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSuggestionIndex(0);
  }, [suggestions]);

  useEffect(() => {
    if (!showSuggestions || suggestions.length === 0) return;
    const el = suggestionRef.current?.querySelector(`#scout-suggestion-${suggestionIndex}`);
    (el as HTMLElement)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [suggestionIndex, showSuggestions, suggestions.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const exportCsv = useCallback(() => {
    if (sortedResults.length === 0) return;
    const headers = ["Name", "Typ", "Adresse", "Telefon", "E-Mail", "Website", "Öffnungszeiten", "ca. m²", "Grundstück m²", "Entfernung (m)", "Quelle"];
    const rows = sortedResults.map((b) => [
      b.name,
      b.type,
      b.address ?? "",
      b.phone ?? "",
      b.email ?? "",
      b.website ?? "",
      b.opening_hours ?? "",
      b.estimatedGrossArea != null ? String(b.estimatedGrossArea) : "",
      b.parcelArea != null ? String(b.parcelArea) : "",
      b.distance > 0 ? String(b.distance) : "",
      sourceLabel(b.source ?? ""),
    ]);
    const escape = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [headers.map(escape).join(";"), ...rows.map((r) => r.map(escape).join(";"))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wgh-scout-${searchLabel ? searchLabel.replace(/\s*[(\u2013–)].*$/u, "").trim().replace(/\s+/g, "-") : "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportiert");
  }, [sortedResults, searchLabel]);

  const search = useCallback(async () => {
    if (!query.trim()) {
      toast.error("Bitte Ort oder Adresse eingeben");
      return;
    }
    searchAbortRef.current?.abort();
    const ac = new AbortController();
    searchAbortRef.current = ac;
    const signal = ac.signal;
    setLoading(true);
    setResults([]);
    setSearchLabel(null);
    setLastBbox(null);
    setLastCenter(null);
    setLoadingStep("ort");
    try {
      if (mode === "ort") {
        const bbox = await aggregateGeocodeToBbox(query.trim(), signal);
        if (signal.aborted) return;
        if (!bbox) {
          if (!signal.aborted) { setLoading(false); setLoadingStep(null); }
          toast.error("Ort nicht gefunden");
          return;
        }
        if (!signal.aborted) {
          setSearchLabel(`Ganzes Gebiet: ${bbox.display_name}`);
          setLastBbox(bbox);
          setLastCenter(null);
          setLoadingStep("gewerbe");
        }
        const { pois: deduped } = await aggregatePOIsByBbox(bbox, signal);
        if (signal.aborted) return;
        if (!signal.aborted) {
          setLoadingStep("gebaeude");
          setResults(deduped);
          setLoadingStep(null);
        }
        try {
          sessionStorage.setItem(SCOUT_STORAGE_KEY, JSON.stringify({
            query: query.trim(), mode: "ort", radius,
            minSize, maxSize, onlyWithPhone, onlyWithWebsite, onlyWithEmail, onlyWithOpeningHours, poiTypeFilter, sortBy,
          }));
        } catch { /* ignore */ }
        if (deduped.length === 0) toast.info("Keine Treffer in diesem Gebiet gefunden");
        else toast.success(`${deduped.length} Treffer in ${bbox.display_name} – sortiert nach Gebäudegröße`);
      } else {
        const coord = await aggregateGeocode(query.trim(), signal);
        if (signal.aborted) return;
        if (!coord) {
          if (!signal.aborted) { setLoading(false); setLoadingStep(null); }
          toast.error("Adresse nicht gefunden");
          return;
        }
        if (!signal.aborted) {
          setSearchLabel(`${coord.display_name} (${radius} m)`);
          setLastBbox(null);
          setLastCenter({ lat: coord.lat, lng: coord.lng });
          setLoadingStep("gewerbe");
        }
        const { pois: deduped } = await aggregatePOIsByRadius(coord.lat, coord.lng, radius, signal);
        if (signal.aborted) return;
        if (!signal.aborted) {
          setLoadingStep("gebaeude");
          setResults(deduped);
          setLoadingStep(null);
        }
        try {
          sessionStorage.setItem(SCOUT_STORAGE_KEY, JSON.stringify({
            query: query.trim(), mode: "umkreis", radius,
            minSize, maxSize, onlyWithPhone, onlyWithWebsite, onlyWithEmail, onlyWithOpeningHours, poiTypeFilter, sortBy,
          }));
        } catch { /* ignore */ }
        if (deduped.length === 0) toast.info("Keine Treffer im gewählten Umkreis gefunden");
        else toast.success(`${deduped.length} Treffer gefunden`);
      }
    } catch (e: unknown) {
      if ((e as { name?: string }).name === "AbortError") return;
      handleError(e, { context: "general", details: "WGHScout.search", showToast: false });
      toastErrorWithRetry("Suche fehlgeschlagen", search);
      setLoadingStep(null);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [query, mode, radius, minSize, maxSize, onlyWithPhone, onlyWithWebsite, onlyWithEmail, onlyWithOpeningHours, poiTypeFilter, sortBy]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Store className="h-4 w-4" /> WGH-Scout
          </span>
          {searchLabel != null && results.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {results.length} Treffer
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Ort oder Adresse eingeben. Ganzer Ort durchsucht die Stadt; Umkreis sucht um eine Adresse. Sortierung nach Gebäudegröße – ideal für Wohn- und Geschäftshäuser (WGH) mit Gewerbe im EG.
        </p>
        {getActiveProviders().length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5" aria-label="Datenquellen">
            Daten: {getActiveProviders().map((p) => p.name).join(", ")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 space-y-1 relative">
              <Label className="text-xs">Ort oder Adresse</Label>
              <Input
                ref={inputRef}
                placeholder="z.B. Hennigsdorf oder Eisenbahnstraße 73, Eberswalde"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowSuggestions(false);
                    inputRef.current?.blur();
                    return;
                  }
                  if (e.key === "Enter") {
                    if (e.metaKey || e.ctrlKey) {
                      e.preventDefault();
                      search();
                      return;
                    }
                    if (showSuggestions && suggestions.length > 0) {
                      e.preventDefault();
                      pickSuggestion(suggestions[suggestionIndex].display_name);
                      return;
                    }
                    search();
                    return;
                  }
                  if (showSuggestions && suggestions.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSuggestionIndex((i) => (i + 1) % suggestions.length);
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSuggestionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
                      return;
                    }
                  }
                }}
                className="h-9 text-sm min-w-0"
                aria-label="Ort oder Adresse für WGH-Scout-Suche"
                aria-autocomplete="list"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-activedescendant={showSuggestions && suggestions.length > 0 ? `scout-suggestion-${suggestionIndex}` : undefined}
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul
                  ref={suggestionRef}
                  className="absolute z-50 top-full left-0 right-0 mt-0.5 rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-[220px] overflow-y-auto"
                  role="listbox"
                  id="scout-suggestions-listbox"
                >
                  {suggestions.map((s, i) => (
                    <li
                      key={s.place_id}
                      id={`scout-suggestion-${i}`}
                      role="option"
                      aria-selected={i === suggestionIndex}
                      className={cn(
                        "px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground text-wrap-safe",
                        i === suggestionIndex && "bg-accent text-accent-foreground"
                      )}
                      onMouseDown={() => pickSuggestion(s.display_name)}
                    >
                      {s.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[130px] space-y-1">
                <Label className="text-xs">Suchmodus</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ort">Ganzer Ort</SelectItem>
                    <SelectItem value="umkreis">Umkreis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mode === "umkreis" && (
                <div className="w-[100px] space-y-1">
                  <Label className="text-xs">Umkreis</Label>
                  <Select value={String(radius)} onValueChange={(v) => setRadius(Number(v))}>
                    <SelectTrigger className="h-9 text-xs min-h-[36px] sm:min-h-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RADIUS_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                onClick={search}
                disabled={loading || !query.trim()}
                className="gap-1.5 shrink-0 h-9 touch-target min-h-[44px] sm:min-h-[36px]"
                aria-label="WGH suchen"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Suchen
              </Button>
              {searchLabel != null && query.trim() && !loading && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px] text-muted-foreground"
                  onClick={search}
                  aria-label="Letzte Suche wiederholen"
                >
                  <Repeat className="h-3.5 w-3.5" /> Erneut
                </Button>
              )}
            </div>
          </div>
        </div>

        {loading && loadingStep && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                {loadingStep === "ort" && "Suche Ort…"}
                {loadingStep === "gewerbe" && "Suche Objekte & Gebäude…"}
                {loadingStep === "gebaeude" && "Ordne Gebäudegrößen zu…"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs touch-target min-h-[36px] sm:min-h-[32px] text-muted-foreground"
                onClick={() => {
                  searchAbortRef.current?.abort();
                  toast.info("Suche abgebrochen");
                }}
                aria-label="Suche abbrechen"
              >
                Abbrechen
              </Button>
            </div>
            {(loadingStep === "gebaeude" || (loadingStep === "gewerbe" && results.length === 0)) && (
              <ul className="space-y-2 max-h-[280px] overflow-hidden" aria-hidden>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <li key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-border bg-muted/30 animate-pulse">
                    <div className="flex-1 space-y-1">
                      <div className="h-4 w-32 rounded bg-muted" />
                      <div className="h-3 w-48 rounded bg-muted" />
                    </div>
                    <div className="flex gap-1.5">
                      <div className="h-8 w-20 rounded bg-muted" />
                      <div className="h-8 w-14 rounded bg-muted" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {searchLabel && !loading && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" /> {searchLabel}
            </p>
            {(lastBbox || lastCenter) && results.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                asChild
              >
                <a
                  href={lastBbox
                    ? `https://www.openstreetmap.org/?bbox=${lastBbox.west},${lastBbox.south},${lastBbox.east},${lastBbox.north}`
                    : `https://www.openstreetmap.org/?mlat=${lastCenter!.lat}&mlon=${lastCenter!.lng}&zoom=15`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Suchgebiet auf OpenStreetMap anzeigen"
                >
                  <Map className="h-3 w-3" /> Auf Karte anzeigen
                </a>
              </Button>
            )}
          </div>
        )}

        {!loading && searchLabel !== null && results.length === 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 flex flex-col sm:flex-row sm:items-start gap-3">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-wrap-safe flex-1">
              <p className="font-medium text-foreground">Keine Treffer gefunden</p>
              <p className="text-muted-foreground mt-1">Tipp: Bei „Ganzer Ort“ die ganze Stadt durchsuchen oder beim Umkreis-Modus den Radius vergrößern (z. B. 5 km oder 10 km).</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link to={`${ROUTES.CRM}?tab=search`} className="text-primary hover:underline text-xs">Stattdessen Adresssuche im CRM →</Link>
                <Link to={ROUTES.BESICHTIGUNGEN} className="text-primary hover:underline text-xs inline-flex items-center gap-1" aria-label="Besichtigung planen">
                  <CalendarCheck className="h-3 w-3" /> Besichtigung planen →
                </Link>
                <Link to={ROUTES.DEALS} className="text-primary hover:underline text-xs inline-flex items-center gap-1" aria-label="Deal anlegen">
                  <Handshake className="h-3 w-3" /> Deal anlegen →
                </Link>
                <Link to={ROUTES.CONTACTS} className="text-primary hover:underline text-xs inline-flex items-center gap-1" aria-label="Zu Kontakten">
                  <Users className="h-3 w-3" /> Kontakte →
                </Link>
              </p>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div ref={resultsSectionRef} className="space-y-2">
            {sortedResults.length === 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-amber-800 dark:text-amber-200">Alle {results.length} Treffer wurden durch die Filter ausgeblendet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                  onClick={() => {
                    setOnlyWithPhone(false);
                    setOnlyWithWebsite(false);
                    setOnlyWithEmail(false);
                    setOnlyWithOpeningHours(false);
                    setMinSize(0);
                    setMaxSize(0);
                    setPoiTypeFilter("all");
                  }}
                  aria-label="Filter zurücksetzen"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Filter zurücksetzen
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium" id="scout-results-heading" aria-live="polite">
                  Gefundene Treffer {results.length !== sortedResults.length ? `(${sortedResults.length} von ${results.length})` : `(${sortedResults.length})`}{sortedResults.length > SCOUT_DISPLAY_CAP ? ` – erste ${SCOUT_DISPLAY_CAP} angezeigt` : ""}{minSize > 0 ? `, ≥ ${minSize} m²` : ""}{maxSize > 0 ? `, ≤ ${maxSize.toLocaleString("de-DE")} m²` : ""}
                </h3>
                {(resultStats.withPhone > 0 || resultStats.withWeb > 0 || resultStats.withEmail > 0) && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {[resultStats.withPhone > 0 && `${resultStats.withPhone} mit Telefon`, resultStats.withWeb > 0 && `${resultStats.withWeb} mit Web`, resultStats.withEmail > 0 && `${resultStats.withEmail} mit E-Mail`].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px] text-muted-foreground"
                  onClick={() => {
                    const base = typeof window !== "undefined" ? `${window.location.origin}/crm` : "/crm";
                    const params = new URLSearchParams({ tab: "scout" });
                    if (query.trim()) params.set("q", query.trim());
                    const url = `${base}?${params.toString()}`;
                    navigator.clipboard.writeText(url).then(() => toast.success("Link kopiert"), () => toast.error("Kopieren fehlgeschlagen"));
                  }}
                  aria-label="Suche teilen (Link kopieren)"
                >
                  <Share2 className="h-3.5 w-3.5" /> Teilen
                </Button>
                {isMobile && (
                  <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]" aria-label="Filter anpassen">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filter
                        {(onlyWithPhone || onlyWithWebsite || onlyWithEmail || onlyWithOpeningHours || minSize > 0 || maxSize > 0 || poiTypeFilter !== "all") && (
                          <span className="ml-0.5 px-1.5 py-0 rounded text-[10px] bg-primary/20 text-primary">
                            {(onlyWithPhone ? 1 : 0) + (onlyWithWebsite ? 1 : 0) + (onlyWithEmail ? 1 : 0) + (onlyWithOpeningHours ? 1 : 0) + (minSize > 0 ? 1 : 0) + (maxSize > 0 ? 1 : 0) + (poiTypeFilter !== "all" ? 1 : 0)}
                          </span>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
                      <SheetHeader>
                        <SheetTitle>Filter</SheetTitle>
                      </SheetHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Typ</Label>
                          <Select value={poiTypeFilter} onValueChange={setPoiTypeFilter}>
                            <SelectTrigger className="h-9 min-h-[44px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {POI_TYPE_CATEGORIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Mindestfläche</Label>
                          <Select value={String(minSize)} onValueChange={(v) => setMinSize(Number(v))}>
                            <SelectTrigger className="h-9 min-h-[44px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MIN_SIZE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Max. Fläche</Label>
                          <Select value={String(maxSize)} onValueChange={(v) => setMaxSize(Number(v))}>
                            <SelectTrigger className="h-9 min-h-[44px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MAX_SIZE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Sortierung</Label>
                          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                            <SelectTrigger className="h-9 min-h-[44px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="size">Nach Gebäudegröße (größte zuerst)</SelectItem>
                              <SelectItem value="distance">Nach Entfernung</SelectItem>
                              <SelectItem value="name">Nach Name</SelectItem>
                              <SelectItem value="source">Nach Quelle</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs">Nur mit</Label>
                          <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                              <input type="checkbox" checked={onlyWithPhone} onChange={(e) => setOnlyWithPhone(e.target.checked)} className="rounded h-4 w-4" />
                              <span className="text-sm">Telefon</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                              <input type="checkbox" checked={onlyWithWebsite} onChange={(e) => setOnlyWithWebsite(e.target.checked)} className="rounded h-4 w-4" />
                              <span className="text-sm">Website</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                              <input type="checkbox" checked={onlyWithEmail} onChange={(e) => setOnlyWithEmail(e.target.checked)} className="rounded h-4 w-4" />
                              <span className="text-sm">E-Mail</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                              <input type="checkbox" checked={onlyWithOpeningHours} onChange={(e) => setOnlyWithOpeningHours(e.target.checked)} className="rounded h-4 w-4" />
                              <span className="text-sm">Öffnungszeiten</span>
                            </label>
                          </div>
                        </div>
                        <Button variant="secondary" className="w-full gap-1.5" onClick={() => { setOnlyWithPhone(false); setOnlyWithWebsite(false); setOnlyWithEmail(false); setOnlyWithOpeningHours(false); setMinSize(0); setMaxSize(0); setPoiTypeFilter("all"); setFilterSheetOpen(false); }} aria-label="Filter zurücksetzen">
                          <RotateCcw className="h-3.5 w-3.5" /> Filter zurücksetzen
                        </Button>
                        <Button variant="outline" className="w-full gap-1.5" onClick={exportCsv} aria-label="CSV exportieren">
                          <Download className="h-3.5 w-3.5" /> CSV exportieren
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                )}
              </div>
              <div className={cn("flex flex-wrap items-center gap-2", isMobile && "hidden")}>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap sr-only sm:not-sr-only">Typ:</Label>
                  <Select value={poiTypeFilter} onValueChange={setPoiTypeFilter}>
                    <SelectTrigger className="h-8 w-[120px] text-xs min-h-[36px] sm:min-h-[32px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POI_TYPE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none touch-target min-h-[44px] sm:min-h-0 py-1 sm:py-0">
                  <input
                    type="checkbox"
                    checked={onlyWithPhone}
                    onChange={(e) => setOnlyWithPhone(e.target.checked)}
                    className="rounded border-input h-4 w-4 touch-target"
                    aria-label="Nur Einträge mit Telefonnummer"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Nur mit Telefon</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none touch-target min-h-[44px] sm:min-h-0 py-1 sm:py-0">
                  <input
                    type="checkbox"
                    checked={onlyWithWebsite}
                    onChange={(e) => setOnlyWithWebsite(e.target.checked)}
                    className="rounded border-input h-4 w-4 touch-target"
                    aria-label="Nur Einträge mit Website"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Nur mit Web</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none touch-target min-h-[44px] sm:min-h-0 py-1 sm:py-0">
                  <input
                    type="checkbox"
                    checked={onlyWithEmail}
                    onChange={(e) => setOnlyWithEmail(e.target.checked)}
                    className="rounded border-input h-4 w-4 touch-target"
                    aria-label="Nur Einträge mit E-Mail"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Nur mit E-Mail</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none touch-target min-h-[44px] sm:min-h-0 py-1 sm:py-0">
                  <input
                    type="checkbox"
                    checked={onlyWithOpeningHours}
                    onChange={(e) => setOnlyWithOpeningHours(e.target.checked)}
                    className="rounded border-input h-4 w-4 touch-target"
                    aria-label="Nur Einträge mit Öffnungszeiten"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Nur mit Öffnungszeiten</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Mind. Fläche:</Label>
                  <Select value={String(minSize)} onValueChange={(v) => setMinSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[100px] text-xs min-h-[36px] sm:min-h-[32px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MIN_SIZE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Max. Fläche:</Label>
                  <Select value={String(maxSize)} onValueChange={(v) => setMaxSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[100px] text-xs min-h-[36px] sm:min-h-[32px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAX_SIZE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Sortierung:</Label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="size">Nach Gebäudegröße (größte zuerst)</SelectItem>
                      <SelectItem value="distance">Nach Entfernung</SelectItem>
                      <SelectItem value="name">Nach Name</SelectItem>
                      <SelectItem value="source">Nach Quelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]" onClick={exportCsv} aria-label="Als CSV exportieren">
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                {(onlyWithPhone || onlyWithWebsite || onlyWithEmail || onlyWithOpeningHours || minSize > 0 || maxSize > 0 || poiTypeFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setOnlyWithPhone(false);
                      setOnlyWithWebsite(false);
                      setOnlyWithEmail(false);
                      setOnlyWithOpeningHours(false);
                      setMinSize(0);
                      setMaxSize(0);
                      setPoiTypeFilter("all");
                    }}
                    aria-label="Filter zurücksetzen"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Filter zurücksetzen
                  </Button>
                )}
              </div>
            </div>
            {sortedResults.length > SCOUT_DISPLAY_CAP && (
              <p className="text-xs text-muted-foreground">
                {SCOUT_DISPLAY_CAP} von {sortedResults.length} angezeigt. Bitte Filter (Typ, Mindest-/Max. Fläche, Nur mit Telefon/Web/E-Mail/Öffnungszeiten) nutzen, um die Liste einzugrenzen.
              </p>
            )}
            <ul
              className="space-y-2 max-h-[420px] overflow-y-auto pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] outline-none"
              role="listbox"
              aria-labelledby="scout-results-heading"
              aria-label="Liste gefundener WGH-Treffer"
              tabIndex={0}
              ref={resultsListRef}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setFocusedResultIndex(null);
                  resultsListRef.current?.blur();
                  return;
                }
                if (visibleResults.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setFocusedResultIndex((i) => (i === null ? 0 : Math.min(i + 1, visibleResults.length - 1)));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setFocusedResultIndex((i) => (i === null ? visibleResults.length - 1 : Math.max(0, i - 1)));
                  return;
                }
                if (e.key === "Enter" && focusedResultIndex !== null) {
                  const li = resultsListRef.current?.children[focusedResultIndex] as HTMLElement | undefined;
                  const first = li?.querySelector<HTMLElement>("a, button");
                  if (first) {
                    e.preventDefault();
                    first.focus();
                  }
                }
              }}
            >
              {visibleResults.map((b, i) => (
                <li
                  key={`${b.name}-${b.lat}-${b.lon}-${i}`}
                  ref={i === focusedResultIndex ? focusedResultRef : undefined}
                  tabIndex={-1}
                  role="option"
                  aria-selected={i === focusedResultIndex}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-border bg-card text-sm touch-target min-h-[44px]",
                    i === focusedResultIndex && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
                  )}
                  onClick={() => setFocusedResultIndex(i)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{b.name}</span>
                      {b.source && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0" title={`Quelle: ${sourceLabel(b.source)}`}>
                          {sourceLabel(b.source)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span>{b.type}</span>
                      {b.estimatedGrossArea != null && b.estimatedGrossArea > 0 && (() => {
                        const areaWarn = getAreaWarning(b.estimatedGrossArea, b.parcelArea);
                        return (
                          <span className="flex items-center gap-0.5">
                            <Building2 className="h-3 w-3" /> ca. {b.estimatedGrossArea.toLocaleString("de-DE")} m²
                            {areaWarn && (
                              <span className="inline-flex items-center text-amber-600 dark:text-amber-500" title={areaWarn} aria-label={areaWarn}>
                                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                              </span>
                            )}
                          </span>
                        );
                      })()}
                      {b.parcelArea != null && b.parcelArea > 0 && (
                        <span className="flex items-center gap-0.5" title="Amtliche Grundstücksfläche (ALKIS)">
                          Grundstück: {b.parcelArea.toLocaleString("de-DE")} m²
                        </span>
                      )}
                      {b.distance > 0 && <span>{b.distance} m</span>}
                      {b.address && <span className="truncate">{b.address}</span>}
                      {b.opening_hours && (
                        <span className="truncate max-w-[180px] sm:max-w-none" title={b.opening_hours}>
                          Öffn.: {b.opening_hours.length > 25 ? `${b.opening_hours.slice(0, 24)}…` : b.opening_hours}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {b.phone ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]"
                        aria-label={`Anrufen: ${b.name}`}
                        onClick={async () => {
                          const result = await startCall(b.phone!.replace(/\s/g, "").trim(), { toLabel: b.name });
                          if (!result?.ok && result?.error) toast.error(result.error);
                        }}
                      >
                        <Phone className="h-3.5 w-3.5" /> Anrufen
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground px-2">Tel. in Maps prüfen</span>
                    )}
                    {b.website && (
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]" asChild>
                        <a href={b.website.startsWith("http") ? b.website : `https://${b.website}`} target="_blank" rel="noreferrer noopener" aria-label={`Website: ${b.name}`}>
                          <Globe className="h-3.5 w-3.5" /> Web
                        </a>
                      </Button>
                    )}
                    {b.email && (
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]" asChild>
                        <a href={`mailto:${b.email.trim()}`} aria-label={`E-Mail: ${b.name}`}>
                          <Mail className="h-3.5 w-3.5" /> E-Mail
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]" asChild>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.address || b.name].filter(Boolean).join(" "))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Google Maps: ${b.name}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Maps
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px] text-muted-foreground"
                      onClick={() => {
                        const text = [b.name, b.address].filter(Boolean).join("\n");
                        navigator.clipboard.writeText(text).then(() => toast.success("Kopiert"), () => toast.error("Kopieren fehlgeschlagen"));
                      }}
                      aria-label={`Kopieren: ${b.name}`}
                    >
                      <Copy className="h-3.5 w-3.5" /> Kopieren
                    </Button>
                    {isDeepSeekConfigured() && (
                      <>
                        <ScoutAiCallPopover business={b} />
                        <ScoutInterestPopover business={b} />
                      </>
                    )}
                    {onAddAsLead && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]"
                        onClick={() => {
                          onAddAsLead({ name: b.name, address: b.address, phone: b.phone });
                          toast.success(`${b.name} als Lead übernommen`);
                        }}
                        aria-label={`Als Lead: ${b.name}`}
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Lead
                      </Button>
                    )}
                    {onAddAsDeal && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]"
                        onClick={() => {
                          onAddAsDeal({ name: b.name, address: b.address, phone: b.phone, email: b.email });
                          toast.success(`${b.name} als Deal-Vorlage – weiter zu Deals`);
                        }}
                        aria-label={`Als Deal: ${b.name}`}
                      >
                        <Handshake className="h-3.5 w-3.5" /> Deal
                      </Button>
                    )}
                    {onAddAsViewing && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]"
                        onClick={() => {
                          onAddAsViewing({ name: b.name, address: b.address });
                          toast.success(`${b.name} als Besichtigung – weiter zu Besichtigungen`);
                        }}
                        aria-label={`Als Besichtigung: ${b.name}`}
                      >
                        <CalendarCheck className="h-3.5 w-3.5" /> Besichtigung
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
