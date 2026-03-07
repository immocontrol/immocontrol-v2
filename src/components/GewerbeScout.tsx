/**
 * Gewerbe-Scout: Findet Gewerbe/Läden im Umkreis einer Adresse (OpenStreetMap/Overpass).
 * Für Akquise von MFH mit Gewerbe im EG – Telefonnummer anrufen, als Lead übernehmen.
 */
import { useState } from "react";
import { MapPin, Phone, Loader2, Search, Store, ExternalLink, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { geocodeToCoord, fetchCommercialPOIsInRadius, type NearbyBusiness } from "@/lib/crmUtils";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";

const RADIUS_OPTIONS = [
  { value: 200, label: "200 m" },
  { value: 500, label: "500 m" },
  { value: 1000, label: "1 km" },
];

export interface GewerbeScoutProps {
  onAddAsLead?: (business: { name: string; address: string | null; phone: string | null }) => void;
}

export default function GewerbeScout({ onAddAsLead }: GewerbeScoutProps) {
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(500);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<NearbyBusiness[]>([]);
  const [searchCenter, setSearchCenter] = useState<{ display_name: string } | null>(null);

  const search = async () => {
    if (!address.trim()) {
      toast.error("Bitte Adresse oder Ort eingeben");
      return;
    }
    setLoading(true);
    setResults([]);
    setSearchCenter(null);
    try {
      const coord = await geocodeToCoord(address.trim());
      if (!coord) {
        toast.error("Adresse nicht gefunden");
        setLoading(false);
        return;
      }
      setSearchCenter({ display_name: coord.display_name });
      const list = await fetchCommercialPOIsInRadius(coord.lat, coord.lng, radius);
      setResults(list);
      if (list.length === 0) toast.info("Keine Gewerbe im gewählten Umkreis gefunden");
      else toast.success(`${list.length} Gewerbe gefunden`);
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
        <p className="text-xs text-muted-foreground">
          Adresse eingeben – Gewerbe/Läden im Umkreis finden (OpenStreetMap). Ideal für MFH mit Gewerbe im EG: Telefon anrufen, Eigentümer erreichen, als Lead übernehmen.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Adresse oder Ort</Label>
            <Input
              placeholder="z.B. Eisenbahnstraße 73, Eberswalde"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="h-9 text-sm"
              aria-label="Adresse für Gewerbesuche"
            />
          </div>
          <div className="flex gap-2">
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
            <Button
              onClick={search}
              disabled={loading || !address.trim()}
              className="gap-1.5 shrink-0 self-end h-9 touch-target min-h-[44px] sm:min-h-[36px]"
              aria-label="Gewerbe suchen"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Suchen
            </Button>
          </div>
        </div>

        {searchCenter && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Zentrum: {searchCenter.display_name}
          </p>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Gefundene Gewerbe ({results.length})</h3>
            <ul className="space-y-2 max-h-[400px] overflow-y-auto">
              {results.map((b, i) => (
                <li
                  key={`${b.name}-${b.distance}-${i}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-border bg-card text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{b.name}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span>{b.type}</span>
                      {b.distance > 0 && <span>{b.distance} m</span>}
                      {b.address && <span className="truncate">{b.address}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {b.phone ? (
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                        <a href={`tel:${b.phone.replace(/\s/g, "")}`} aria-label={`Anrufen: ${b.name}`}>
                          <Phone className="h-3.5 w-3.5" /> Anrufen
                        </a>
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground px-2">Tel. in Maps prüfen</span>
                    )}
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
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
                        className="h-8 gap-1 text-xs"
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
