import { useState, useMemo, useCallback } from "react";
import { TrendingUp, MapPin, Building2, Calculator, Info, RefreshCw, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { toast } from "sonner";

interface ValuationResult {
  ertragswert: number;
  sachwert: number;
  vergleichswert: number;
  durchschnitt: number;
  bodenrichtwert: number | null;
  bodenrichtwertQm: number;
  grundstueckFlaeche: number;
}

/** Feature 6: Automatische Wertermittlung mit Bodenrichtwert-Schätzung */
const PropertyValuation = ({
  propertyName = "",
  address = "",
  sqm = 0,
  monthlyRent = 0,
  yearBuilt = 0,
  purchasePrice = 0,
  currentValue = 0,
  type = "MFH",
}: {
  propertyName?: string;
  address?: string;
  sqm?: number;
  monthlyRent?: number;
  yearBuilt?: number;
  purchasePrice?: number;
  currentValue?: number;
  type?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    address,
    sqm,
    monthlyRent,
    yearBuilt: yearBuilt || 1970,
    purchasePrice,
    grundstueckFlaeche: 0,
    liegenschaftszins: 5.0,
    bewirtschaftungskosten: 25,
    restnutzungsdauer: 0,
    baukosten: 2000, // €/m² Herstellungskosten
    bodenrichtwertManual: 0,
  });
  const [bodenrichtwertResult, setBodenrichtwertResult] = useState<number | null>(null);
  const [geocodeInfo, setGeoCodeInfo] = useState<string>("");

  // Calculate Restnutzungsdauer based on year built
  const restnutzung = useMemo(() => {
    if (form.restnutzungsdauer > 0) return form.restnutzungsdauer;
    const age = new Date().getFullYear() - (form.yearBuilt || 1970);
    const total = form.yearBuilt >= 2000 ? 80 : 60;
    return Math.max(total - age, 10);
  }, [form.yearBuilt, form.restnutzungsdauer]);

  /** Lookup Bodenrichtwert via free BORIS/BKG geocoding */
  const lookupBodenrichtwert = useCallback(async () => {
    if (!form.address) {
      toast.error("Bitte Adresse eingeben");
      return;
    }
    setLoading(true);
    try {
      // Step 1: Geocode the address using Nominatim
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address)}&countrycodes=de&limit=1`,
        { headers: { "User-Agent": "ImmoControl/1.0" } }
      );
      const geoData = await geoRes.json();
      if (!geoData || geoData.length === 0) {
        toast.error("Adresse nicht gefunden");
        setLoading(false);
        return;
      }

      const { lat, lon, display_name } = geoData[0];
      setGeoCodeInfo(display_name);

      // Step 2: Try BORIS API (free Bodenrichtwert service)
      // The BORIS API varies by state. We'll use a heuristic based on location data.
      // Since the official BORIS APIs require state-specific endpoints and may have CORS issues,
      // we estimate based on known averages for German regions.
      const estimatedBRW = estimateBodenrichtwert(Number(lat), Number(lon), form.address);
      setBodenrichtwertResult(estimatedBRW);

      toast.success(`Bodenrichtwert geschätzt: ${estimatedBRW} €/m²`);
    } catch {
      toast.error("Fehler bei der Adresssuche");
    } finally {
      setLoading(false);
    }
  }, [form.address]);

  /** Estimate Bodenrichtwert based on location heuristics */
  const estimateBodenrichtwert = (lat: number, lon: number, address: string): number => {
    const addr = address.toLowerCase();
    // Major German cities with known average Bodenrichtwerte (€/m²)
    if (addr.includes("münchen") || addr.includes("munich")) return 3500;
    if (addr.includes("frankfurt")) return 1800;
    if (addr.includes("hamburg")) return 1600;
    if (addr.includes("düsseldorf")) return 1400;
    if (addr.includes("köln") || addr.includes("cologne")) return 1200;
    if (addr.includes("stuttgart")) return 1500;
    if (addr.includes("berlin")) return 800;
    if (addr.includes("leipzig")) return 350;
    if (addr.includes("dresden")) return 400;
    if (addr.includes("potsdam")) return 500;
    if (addr.includes("eberswalde")) return 60;
    if (addr.includes("nürnberg")) return 700;
    if (addr.includes("hannover")) return 550;
    if (addr.includes("dortmund") || addr.includes("essen")) return 450;
    if (addr.includes("bonn")) return 700;
    if (addr.includes("freiburg")) return 900;
    if (addr.includes("heidelberg")) return 800;
    if (addr.includes("mainz") || addr.includes("wiesbaden")) return 650;

    // Regional estimation based on latitude/longitude
    // Southern Germany tends to be more expensive
    if (lat > 48.5) return 500; // Bayern/BaWü
    if (lat > 50.5) return 300; // Hessen/Thüringen
    if (lat > 52.0) return 200; // NRW/Niedersachsen/Sachsen
    return 120; // Brandenburg/MV/SH
  };

  const brw = bodenrichtwertResult || form.bodenrichtwertManual || 0;

  const valuation = useMemo<ValuationResult>(() => {
    const jahresRohertrag = form.monthlyRent * 12;
    const bewirtschaftung = jahresRohertrag * (form.bewirtschaftungskosten / 100);
    const jahresReinertrag = jahresRohertrag - bewirtschaftung;

    // Bodenrichtwert-basierter Bodenwert
    const grundstueckFlaeche = form.grundstueckFlaeche || form.sqm * 0.5;
    const bodenwert = grundstueckFlaeche * brw;

    // Liegenschaftszins
    const lz = form.liegenschaftszins / 100;

    // Bodenwertverzinsung
    const bodenwertverzinsung = bodenwert * lz;

    // Gebäudereinertrag
    const gebaeudeReinertrag = jahresReinertrag - bodenwertverzinsung;

    // Vervielfältiger (Barwertfaktor)
    const v = lz > 0 ? (1 - Math.pow(1 + lz, -restnutzung)) / lz : restnutzung;

    // Ertragswert = Bodenwert + Gebäudeertragswert
    const gebaeudeErtragswert = Math.max(gebaeudeReinertrag * v, 0);
    const ertragswert = bodenwert + gebaeudeErtragswert;

    // Sachwert = Bodenwert + Herstellungskosten * Altersminderung
    const herstellungskosten = form.sqm * form.baukosten;
    const altersminderung = Math.max(1 - ((new Date().getFullYear() - form.yearBuilt) / (form.yearBuilt >= 2000 ? 80 : 60)), 0.3);
    const sachwert = bodenwert + herstellungskosten * altersminderung;

    // Vergleichswert (simplified: based on €/m² regional average)
    const preisProQm = brw > 0 ? brw * 15 : form.purchasePrice > 0 && form.sqm > 0 ? form.purchasePrice / form.sqm : 2000;
    const vergleichswert = form.sqm * preisProQm;

    // Durchschnitt der drei Verfahren
    const validValues = [ertragswert, sachwert].filter(v => v > 0);
    const durchschnitt = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;

    return {
      ertragswert: Math.round(ertragswert),
      sachwert: Math.round(sachwert),
      vergleichswert: Math.round(vergleichswert),
      durchschnitt: Math.round(durchschnitt),
      bodenrichtwert: brw,
      bodenrichtwertQm: brw,
      grundstueckFlaeche,
    };
  }, [form, brw, restnutzung]);

  const changeVsKauf = purchasePrice > 0 && valuation.durchschnitt > 0
    ? ((valuation.durchschnitt - purchasePrice) / purchasePrice) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
          <TrendingUp className="h-3.5 w-3.5" /> Wertermittlung
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Wertermittlung
            {propertyName && <Badge variant="outline" className="text-xs">{propertyName}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Address & Bodenrichtwert Lookup */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Standort & Bodenrichtwert
            </h3>
            <div className="flex gap-2">
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Adresse eingeben..."
                className="h-9 text-sm flex-1"
              />
              <Button size="sm" onClick={lookupBodenrichtwert} disabled={loading} className="gap-1.5 shrink-0">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                BRW ermitteln
              </Button>
            </div>
            {geocodeInfo && <p className="text-[10px] text-muted-foreground truncate">{geocodeInfo}</p>}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Bodenrichtwert €/m²</Label>
                <NumberInput
                  value={bodenrichtwertResult || form.bodenrichtwertManual}
                  onChange={v => { setBodenrichtwertResult(null); setForm(f => ({ ...f, bodenrichtwertManual: v })); }}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Grundstücksfläche m²</Label>
                <NumberInput value={form.grundstueckFlaeche} onChange={v => setForm(f => ({ ...f, grundstueckFlaeche: v }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Wohnfläche m²</Label>
                <NumberInput value={form.sqm} onChange={v => setForm(f => ({ ...f, sqm: v }))} className="h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5" /> Bewertungsparameter
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Kaltmiete €/Monat</Label>
                <NumberInput value={form.monthlyRent} onChange={v => setForm(f => ({ ...f, monthlyRent: v }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Baujahr</Label>
                <NumberInput value={form.yearBuilt} onChange={v => setForm(f => ({ ...f, yearBuilt: v }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Liegenschaftszins %</Label>
                <NumberInput value={form.liegenschaftszins} onChange={v => setForm(f => ({ ...f, liegenschaftszins: v }))} className="h-8 text-xs" decimals />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Bewirtschaftung %</Label>
                <NumberInput value={form.bewirtschaftungskosten} onChange={v => setForm(f => ({ ...f, bewirtschaftungskosten: v }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Restnutzungsdauer J.</Label>
                <NumberInput value={restnutzung} onChange={v => setForm(f => ({ ...f, restnutzungsdauer: v }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Baukosten €/m²</Label>
                <NumberInput value={form.baukosten} onChange={v => setForm(f => ({ ...f, baukosten: v }))} className="h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ergebnisse</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="gradient-card rounded-xl border border-border p-4">
                <div className="text-[10px] text-muted-foreground uppercase">Ertragswertverfahren</div>
                <div className="text-xl font-bold mt-1">{formatCurrency(valuation.ertragswert)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Basierend auf Mieteinnahmen und Restnutzungsdauer</p>
              </div>
              <div className="gradient-card rounded-xl border border-border p-4">
                <div className="text-[10px] text-muted-foreground uppercase">Sachwertverfahren</div>
                <div className="text-xl font-bold mt-1">{formatCurrency(valuation.sachwert)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Basierend auf Herstellungskosten und Alterswertminderung</p>
              </div>
            </div>

            {/* Combined value */}
            <div className="gradient-card rounded-xl border border-primary/30 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Geschätzter Marktwert</div>
                  <div className="text-2xl font-bold text-primary mt-1">{formatCurrency(valuation.durchschnitt)}</div>
                </div>
                {purchasePrice > 0 && (
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">vs. Kaufpreis</div>
                    <div className={`text-lg font-bold ${changeVsKauf >= 0 ? "text-profit" : "text-loss"}`}>
                      {changeVsKauf >= 0 ? "+" : ""}{formatPercent(changeVsKauf)}
                    </div>
                  </div>
                )}
              </div>
              {brw > 0 && (
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Bodenrichtwert: {brw} €/m² · Bodenwert: {formatCurrency(valuation.grundstueckFlaeche * brw)}
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Hinweis: Schätzwerte basierend auf vereinfachten Verfahren. Für offizielle Bewertungen bitte Gutachter beauftragen.
            Bodenrichtwerte sind Näherungswerte basierend auf regionalen Durchschnittsdaten.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PropertyValuation;
