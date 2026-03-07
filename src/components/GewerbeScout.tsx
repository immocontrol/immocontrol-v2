/**
 * Gewerbe-Scout: Findet Gewerbe/Läden nach Ort oder Umkreis (OpenStreetMap/Overpass).
 * Berücksichtigt Gebäudegröße – sortierbar nach größten Wohn- und Geschäftshäusern mit Gewerbe.
 */
import { useState, useMemo } from "react";
import { MapPin, Phone, Loader2, Search, Store, ExternalLink, UserPlus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  geocodeToCoord,
  geocodePlaceToBbox,
  fetchCommercialPOIsInRadius,
  fetchCommercialPOIsInBbox,
  fetchBuildingsInBbox,
  fetchBuildingsInRadius,
  attachBuildingSizes,
  type CommercialPOIWithCoord,
} from "@/lib/crmUtils";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";

type SearchMode = "ort" | "umkreis";

const RADIUS_OPTIONS = [
  { value: 200, label: "200 m" },
  { value: 500, label: "500 m" },
  { value: 1000, label: "1 km" },
];

type SortBy = "size" | "distance" | "name";

export interface ScoutResult extends CommercialPOIWithCoord {
  estimatedGrossArea: number | null;
}

export interface GewerbeScoutProps {
  onAddAsLead?: (business: { name: string; address: string | null; phone: string | null }) => void;
}

export default function GewerbeScout({ onAddAsLead }: GewerbeScoutProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("ort");
  const [radius, setRadius] = useState(500);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScoutResult[]>([]);
  const [searchLabel, setSearchLabel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("size");

  const sortedResults = useMemo(() => {
    const list = [...results];
    if (sortBy === "size") {
      list.sort((a, b) => (b.estimatedGrossArea ?? 0) - (a.estimatedGrossArea ?? 0));
    } else if (sortBy === "distance") {
      list.sort((a, b) => a.distance - b.distance);
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [results, sortBy]);

  const search = async () => {
    if (!query.trim()) {
      toast.error("Bitte Ort oder Adresse eingeben");
      return;
    }
    setLoading(true);
    setResults([]);
    setSearchLabel(null);
    try {
      if (mode === "ort") {
        const bbox = await geocodePlaceToBbox(query.trim());
        if (!bbox) {
          toast.error("Ort nicht gefunden");
          setLoading(false);
          return;
        }
        setSearchLabel(`Ganzes Gebiet: ${bbox.display_name}`);
        const [pois, buildings] = await Promise.all([
          fetchCommercialPOIsInBbox(bbox),
          fetchBuildingsInBbox(bbox),
        ]);
        const withSize = attachBuildingSizes(pois, buildings, 80);
        setResults(withSize);
        if (withSize.length === 0) toast.info("Keine Gewerbe in diesem Gebiet gefunden");
        else toast.success(`${withSize.length} Gewerbe in ${bbox.display_name} – sortiert nach Gebäudegröße`);
      } else {
        const coord = await geocodeToCoord(query.trim());
        if (!coord) {
          toast.error("Adresse nicht gefunden");
          setLoading(false);
          return;
        }
        setSearchLabel(`${coord.display_name} (${radius} m)`);
        const [pois, buildings] = await Promise.all([
          fetchCommercialPOIsInRadius(coord.lat, coord.lng, radius),
          fetchBuildingsInRadius(coord.lat, coord.lng, radius),
        ]);
        const withSize = attachBuildingSizes(pois, buildings, 60);
        setResults(withSize);
        if (withSize.length === 0) toast.info("Keine Gewerbe im gewählten Umkreis gefunden");
        else toast.success(`${withSize.length} Gewerbe gefunden`);
      }
    } catch (e: unknown) {
      handleError(e, { context: "general", details: "GewerbeScout.search", showToast: false });
      toastErrorWithRetry("Suche fehlgeschlagen", search);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Store className="h-4 w-4" /> Gewerbe-Scout
        </CardTitle>
        <p className="text-xs text-muted-foreground text-wrap-safe">
          Ort (z. B. „Hennigsdorf“) oder Adresse eingeben. Ganzer Ort durchsucht die gesamte Stadt nach Gewerben; Umkreis sucht um eine Adresse. Ergebnisse können nach Gebäudegröße sortiert werden – ideal für MFH mit Gewerbe im EG.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Ort oder Adresse</Label>
              <Input
                placeholder="z.B. Hennigsdorf oder Eisenbahnstraße 73, Eberswalde"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="h-9 text-sm min-w-0"
                aria-label="Ort oder Adresse für Gewerbesuche"
              />
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
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
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
                aria-label="Gewerbe suchen"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Suchen
              </Button>
            </div>
          </div>
        </div>

        {searchLabel && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" /> {searchLabel}
          </p>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Gefundene Gewerbe ({results.length})</h3>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Sortierung:</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="size">Nach Gebäudegröße (größte zuerst)</SelectItem>
                    <SelectItem value="distance">Nach Entfernung</SelectItem>
                    <SelectItem value="name">Nach Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ul className="space-y-2 max-h-[420px] overflow-y-auto" role="list">
              {sortedResults.map((b, i) => (
                <li
                  key={`${b.name}-${b.lat}-${b.lon}-${i}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-border bg-card text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{b.name}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span>{b.type}</span>
                      {b.estimatedGrossArea != null && b.estimatedGrossArea > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Building2 className="h-3 w-3" /> ca. {b.estimatedGrossArea.toLocaleString("de-DE")} m²
                        </span>
                      )}
                      {b.distance > 0 && <span>{b.distance} m</span>}
                      {b.address && <span className="truncate">{b.address}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {b.phone ? (
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]" asChild>
                        <a href={`tel:${b.phone.replace(/\s/g, "")}`} aria-label={`Anrufen: ${b.name}`}>
                          <Phone className="h-3.5 w-3.5" /> Anrufen
                        </a>
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground px-2">Tel. in Maps prüfen</span>
                    )}
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs touch-target min-h-[36px] sm:min-h-[32px]" asChild>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.address || b.name].filter(Boolean).join(" "))}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Google Maps: ${b.name}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Maps
                      </a>
                    </Button>
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
