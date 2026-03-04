/**
 * Immobilien-Schnellbewertung Page
 * Upload an Expose PDF → extract data → run 3 valuation methods → generate PDF report
 * + Optional Sparkasse S-ImmoPreisfinder integration for comparison
 */
import { useState, useMemo, useCallback } from "react";
import {
  Upload, FileText, TrendingUp, MapPin, Calculator, Download, Loader2,
  CheckCircle2, AlertTriangle, Building2, RefreshCw, ExternalLink,
  ChevronDown, ChevronUp, Sparkles, BadgePercent, Home, Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { toast } from "sonner";
import { extractPdfText, parseExposeText, type ParsedExposeData } from "@/lib/exposeParser";
import { generateBewertungsPdf, type ValuationResults } from "@/lib/bewertungPdfReport";

/** Sparkasse ImmoPreisfinder property type mapping */
const SPARKASSE_TYPES = {
  EFH: "Ein- und Zweifamilienhaus",
  DHH: "Doppelhaushälfte",
  RMH: "Reihenmittelhaus",
  REH: "Reihenendhaus",
  MFH: "Mehrfamilienhaus",
  ETW: "Wohnung",
  Bungalow: "Bungalow",
  Villa: "Villa / Unikat",
  Sonstige: "Ein- und Zweifamilienhaus",
} as const;

/** Estimate Bodenrichtwert based on location heuristics */
function estimateBodenrichtwert(lat: number, lon: number, address: string): number {
  const addr = address.toLowerCase();
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
  if (addr.includes("bernau")) return 120;
  if (addr.includes("nürnberg")) return 700;
  if (addr.includes("hannover")) return 550;
  if (addr.includes("dortmund") || addr.includes("essen")) return 450;
  if (addr.includes("bonn")) return 700;
  if (addr.includes("freiburg")) return 900;
  if (addr.includes("heidelberg")) return 800;
  if (addr.includes("mainz") || addr.includes("wiesbaden")) return 650;
  if (addr.includes("rostock")) return 200;
  if (addr.includes("magdeburg")) return 150;
  if (addr.includes("erfurt")) return 250;
  // Regional estimation
  if (lat > 53.0) return 120;
  if (lat > 51.5) return 200;
  if (lat > 49.5) return 300;
  return 500;
}

type Step = "upload" | "review" | "results";

const ImmobilienBewertung = () => {
  const [step, setStep] = useState<Step>("upload");
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedExposeData | null>(null);
  const [brwLoading, setBrwLoading] = useState(false);
  const [sparkasseLoading, setSparkasseLoading] = useState(false);
  const [sparkasseRequested, setSparkasseRequested] = useState(false);
  const [sparkasseEmail, setSparkasseEmail] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  // Editable valuation parameters
  const [params, setParams] = useState({
    liegenschaftszins: 5.0,
    bewirtschaftungskosten: 25,
    baukosten: 2000,
    restnutzungsdauer: 0,
    bodenrichtwert: 0,
  });

  /** Handle PDF upload */
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Bitte eine PDF-Datei hochladen");
      return;
    }
    setUploading(true);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) {
        toast.error("Kein Text im PDF gefunden (möglicherweise ein gescanntes PDF)");
        setUploading(false);
        return;
      }
      const data = parseExposeText(text);
      setParsedData(data);

      // Auto-lookup Bodenrichtwert if address found
      if (data.address) {
        await lookupBrw(data.address);
      }

      toast.success(`Exposé analysiert: ${data.extractedFields.length} Felder erkannt (${data.confidence}% Konfidenz)`);
      setStep("review");
    } catch (err: unknown) {
      toast.error(`Fehler: ${err instanceof Error ? err.message : "PDF konnte nicht gelesen werden"}`);
    } finally {
      setUploading(false);
    }
  }, []);

  /** Lookup Bodenrichtwert via Nominatim geocoding */
  const lookupBrw = useCallback(async (address: string) => {
    if (!address) return;
    setBrwLoading(true);
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=de&limit=1`,
        { headers: { "User-Agent": "ImmoControl/1.0" } }
      );
      const geoData = await geoRes.json();
      if (geoData?.length > 0) {
        const brw = estimateBodenrichtwert(Number(geoData[0].lat), Number(geoData[0].lon), address);
        setParams(p => ({ ...p, bodenrichtwert: brw }));
        toast.success(`Bodenrichtwert geschätzt: ${brw} €/m²`);
      } else {
        toast.info("Adresse nicht gefunden — Bodenrichtwert manuell eingeben");
      }
    } catch {
      toast.error("Fehler bei der Adresssuche");
    } finally {
      setBrwLoading(false);
    }
  }, []);

  /** Update parsed data field */
  const updateField = useCallback(<K extends keyof ParsedExposeData>(key: K, value: ParsedExposeData[K]) => {
    setParsedData(prev => prev ? { ...prev, [key]: value } : prev);
  }, []);

  /** Compute valuation results */
  const valuation = useMemo<ValuationResults | null>(() => {
    if (!parsedData) return null;

    const monthlyRent = parsedData.kaltmiete || 0;
    const sqm = parsedData.wohnflaeche || 0;
    const yearBuilt = parsedData.baujahr || 1970;
    const brw = params.bodenrichtwert || 0;

    // Use jahresmiete directly if available (from Jahresnettokaltmiete/Mieteinnahmen),
    // otherwise fall back to kaltmiete * 12
    const jahresRohertrag = parsedData.jahresmiete > 0 ? parsedData.jahresmiete : monthlyRent * 12;
    const bewirtschaftung = jahresRohertrag * (params.bewirtschaftungskosten / 100);
    const jahresReinertrag = jahresRohertrag - bewirtschaftung;

    const grundstueckFlaeche = parsedData.grundstueckFlaeche || sqm * 0.5;
    const bodenwert = grundstueckFlaeche * brw;

    const lz = params.liegenschaftszins / 100;
    const bodenwertverzinsung = bodenwert * lz;
    const gebaeudeReinertrag = jahresReinertrag - bodenwertverzinsung;

    // Restnutzungsdauer
    const rest = params.restnutzungsdauer > 0
      ? params.restnutzungsdauer
      : Math.max((yearBuilt >= 2000 ? 80 : 60) - (new Date().getFullYear() - yearBuilt), 10);

    const v = lz > 0 ? (1 - Math.pow(1 + lz, -rest)) / lz : rest;
    const gebaeudeErtragswert = Math.max(gebaeudeReinertrag * v, 0);
    const ertragswert = bodenwert + gebaeudeErtragswert;

    const herstellungskosten = sqm * params.baukosten;
    const altersminderung = Math.max(1 - ((new Date().getFullYear() - yearBuilt) / (yearBuilt >= 2000 ? 80 : 60)), 0.3);
    const sachwert = bodenwert + herstellungskosten * altersminderung;

    // Vergleichswert: Convert Bodenrichtwert (land €/m²) to property price (€/m² living area)
    // Using realistic regional multipliers instead of a fixed factor.
    // Typical ratio: property price ≈ BRW * (1.5–3.5) depending on density/market.
    // For high BRW areas (>1000 €/m²), use lower multiplier (urban, smaller plots per m² living area).
    // For low BRW areas (<200 €/m²), use higher multiplier (rural, larger plots).
    const brwToPrice = brw > 1000 ? 2.0 : brw > 500 ? 2.5 : brw > 200 ? 3.0 : 3.5;
    const preisProQm = brw > 0 ? brw * brwToPrice : parsedData.kaufpreis > 0 && sqm > 0 ? parsedData.kaufpreis / sqm : 2000;
    const vergleichswert = sqm * preisProQm;

    const validValues = [ertragswert, sachwert, vergleichswert].filter(val => val > 0);
    const durchschnitt = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;

    return {
      ertragswert: Math.round(ertragswert),
      sachwert: Math.round(sachwert),
      vergleichswert: Math.round(vergleichswert),
      durchschnitt: Math.round(durchschnitt),
      bodenrichtwert: brw,
      bodenwert: Math.round(bodenwert),
      jahresRohertrag: Math.round(jahresRohertrag),
      jahresReinertrag: Math.round(jahresReinertrag),
      restnutzungsdauer: rest,
      vervielfaeltiger: v,
      herstellungskosten: Math.round(herstellungskosten),
      altersminderung,
      brwToPrice,
    };
  }, [parsedData, params]);

  /** Generate and download PDF report */
  const handleDownloadPdf = useCallback(() => {
    if (!parsedData || !valuation) return;
    generateBewertungsPdf(parsedData, valuation, {
      requested: sparkasseRequested,
      email: sparkasseEmail || undefined,
    });
    toast.success("PDF-Bericht heruntergeladen");
  }, [parsedData, valuation, sparkasseRequested, sparkasseEmail]);

  /** Request Sparkasse S-ImmoPreisfinder evaluation */
  const handleSparkasseRequest = useCallback(async () => {
    if (!sparkasseEmail || !sparkasseEmail.includes("@")) {
      toast.error("Bitte eine gültige E-Mail-Adresse eingeben");
      return;
    }
    if (!parsedData) return;

    setSparkasseLoading(true);
    try {
      // Open the Sparkasse form in a new tab with instructions
      // Since the form requires JavaScript interaction, we provide the user with pre-filled guidance
      const sparkasseUrl = "https://www.spk-barnim.de/de/home/immobilien0/s-immopreisfinder.html?n=true&stref=hnav";
      window.open(sparkasseUrl, "_blank");

      setSparkasseRequested(true);
      toast.success(
        "Sparkasse S-ImmoPreisfinder geöffnet! Bitte füllen Sie das Formular mit den folgenden Daten aus:\n" +
        `Typ: ${SPARKASSE_TYPES[parsedData.immobilientyp] || "Sonstige"}\n` +
        `Adresse: ${parsedData.address}\n` +
        `E-Mail: ${sparkasseEmail}`,
        { duration: 15000 }
      );
    } finally {
      setSparkasseLoading(false);
    }
  }, [parsedData, sparkasseEmail]);

  /** Drag and drop handler */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  /** Calculate diff vs purchase price */
  const changeVsKauf = parsedData && parsedData.kaufpreis > 0 && valuation
    ? ((valuation.durchschnitt - parsedData.kaufpreis) / parsedData.kaufpreis) * 100
    : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Immobilien-Schnellbewertung
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Exposé-PDF hochladen &rarr; Daten extrahieren &rarr; 3 Bewertungsverfahren &rarr; PDF-Bericht
          </p>
        </div>
        {step !== "upload" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setStep("upload"); setParsedData(null); setSparkasseRequested(false); }}>
              Neues Exposé
            </Button>
            {valuation && (
              <Button size="sm" className="gap-1.5" onClick={handleDownloadPdf}>
                <Download className="h-3.5 w-3.5" /> PDF-Bericht
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs">
        {(["upload", "review", "results"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-border" />}
            <button
              onClick={() => { if (parsedData || s === "upload") setStep(s); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                step === s ? "bg-primary text-primary-foreground" :
                (s === "upload" || parsedData) ? "bg-secondary text-foreground hover:bg-secondary/80 cursor-pointer" :
                "bg-secondary/50 text-muted-foreground cursor-not-allowed"
              }`}
            >
              {s === "upload" && <Upload className="h-3 w-3" />}
              {s === "review" && <FileText className="h-3 w-3" />}
              {s === "results" && <TrendingUp className="h-3 w-3" />}
              {s === "upload" ? "Upload" : s === "review" ? "Daten prüfen" : "Bewertung"}
            </button>
          </div>
        ))}
      </div>

      {/* STEP 1: Upload */}
      {step === "upload" && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed rounded-2xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFileUpload(file);
            };
            input.click();
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm font-medium">Exposé wird analysiert...</p>
              <p className="text-xs text-muted-foreground">Text extrahieren &rarr; Daten erkennen &rarr; Bodenrichtwert ermitteln</p>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-lg font-semibold">Exposé-PDF hochladen</p>
              <p className="text-sm text-muted-foreground mt-2">
                PDF hierher ziehen oder klicken zum Auswählen
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Unterstützt: ImmoScout24, Immowelt, Makler-Exposés und alle PDFs mit eingebettetem Text
              </p>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Review extracted data */}
      {step === "review" && parsedData && (
        <div className="space-y-5">
          {/* Confidence indicator */}
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${
            parsedData.confidence >= 60 ? "bg-profit/5 border-profit/20" :
            parsedData.confidence >= 30 ? "bg-primary/5 border-primary/20" :
            "bg-loss/5 border-loss/20"
          }`}>
            {parsedData.confidence >= 60 ? (
              <CheckCircle2 className="h-5 w-5 text-profit shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-loss shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">
                {parsedData.extractedFields.length} Felder erkannt ({parsedData.confidence}% Konfidenz)
              </p>
              <p className="text-xs text-muted-foreground">
                {parsedData.confidence < 60
                  ? "Bitte prüfen und fehlende Felder manuell ergänzen"
                  : "Daten erkannt — bitte prüfen und bei Bedarf korrigieren"}
              </p>
            </div>
          </div>

          {/* Extracted fields grid */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Objektdaten
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Adresse
                  {parsedData.extractedFields.includes("address") && <Badge variant="outline" className="text-[8px] h-4 ml-1">erkannt</Badge>}
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    value={parsedData.address}
                    onChange={e => updateField("address", e.target.value)}
                    placeholder="Straße Nr, PLZ Ort"
                    className="h-8 text-xs flex-1"
                  />
                  <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={() => lookupBrw(parsedData.address)} disabled={brwLoading}>
                    <RefreshCw className={`h-3 w-3 ${brwLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Home className="h-3 w-3" /> Immobilientyp
                  {parsedData.extractedFields.includes("immobilientyp") && <Badge variant="outline" className="text-[8px] h-4 ml-1">erkannt</Badge>}
                </Label>
                <Select value={parsedData.immobilientyp} onValueChange={(v) => updateField("immobilientyp", v as ParsedExposeData["immobilientyp"])}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["EFH", "DHH", "RMH", "REH", "MFH", "ETW", "Bungalow", "Villa", "Sonstige"] as const).map(t => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Wohnfläche m²</Label>
                <NumberInput value={parsedData.wohnflaeche} onChange={v => updateField("wohnflaeche", v)} className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Grundstücksfläche m²</Label>
                <NumberInput value={parsedData.grundstueckFlaeche} onChange={v => updateField("grundstueckFlaeche", v)} className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Baujahr</Label>
                <NumberInput value={parsedData.baujahr} onChange={v => updateField("baujahr", v)} className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Zimmer</Label>
                <NumberInput value={parsedData.zimmer} onChange={v => updateField("zimmer", v)} className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Kaufpreis €</Label>
                <NumberInput value={parsedData.kaufpreis} onChange={v => updateField("kaufpreis", v)} className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Kaltmiete €/Monat</Label>
                <NumberInput value={parsedData.kaltmiete} onChange={v => updateField("kaltmiete", v)} className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Zustand</Label>
                <Select value={parsedData.zustand} onValueChange={(v) => updateField("zustand", v as ParsedExposeData["zustand"])}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["Erstbezug", "Neuwertig", "Modernisiert", "Gepflegt", "Renovierungsbeduerftig", "Unbekannt"] as const).map(z => (
                      <SelectItem key={z} value={z} className="text-xs">{z === "Renovierungsbeduerftig" ? "Renovierungsbedürftig" : z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Ausstattung</Label>
                <Select value={parsedData.ausstattung} onValueChange={(v) => updateField("ausstattung", v as ParsedExposeData["ausstattung"])}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["Einfach", "Normal", "Gehoben", "Stark gehoben", "Unbekannt"] as const).map(a => (
                      <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Energiekennwert kWh/(m²*a)</Label>
                <NumberInput value={parsedData.energiekennwert} onChange={v => updateField("energiekennwert", v)} className="h-8 text-xs" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Stellplätze</Label>
                <NumberInput value={parsedData.stellplaetze} onChange={v => updateField("stellplaetze", v)} className="h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Advanced parameters */}
          <div className="space-y-3">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Calculator className="h-3.5 w-3.5" />
              Bewertungsparameter anpassen
              {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-3 rounded-lg bg-secondary/30">
                <div className="space-y-1">
                  <Label className="text-[10px]">Bodenrichtwert €/m²</Label>
                  <NumberInput value={params.bodenrichtwert} onChange={v => setParams(p => ({ ...p, bodenrichtwert: v }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Liegenschaftszins %</Label>
                  <NumberInput value={params.liegenschaftszins} onChange={v => setParams(p => ({ ...p, liegenschaftszins: v }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Bewirtschaftung %</Label>
                  <NumberInput value={params.bewirtschaftungskosten} onChange={v => setParams(p => ({ ...p, bewirtschaftungskosten: v }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Baukosten €/m²</Label>
                  <NumberInput value={params.baukosten} onChange={v => setParams(p => ({ ...p, baukosten: v }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Restnutzungsdauer J.</Label>
                  <NumberInput value={params.restnutzungsdauer} onChange={v => setParams(p => ({ ...p, restnutzungsdauer: v }))} className="h-8 text-xs" />
                </div>
              </div>
            )}
          </div>

          {/* Raw text toggle */}
          <button
            onClick={() => setShowRawText(!showRawText)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Extrahierter Text {showRawText ? "ausblenden" : "anzeigen"}
          </button>
          {showRawText && (
            <pre className="p-3 rounded-lg bg-secondary/30 text-xs font-mono max-h-[200px] overflow-y-auto whitespace-pre-wrap">
              {parsedData.rawText}
            </pre>
          )}

          {/* Continue button */}
          <div className="flex justify-end">
            <Button onClick={() => setStep("results")} className="gap-1.5">
              <TrendingUp className="h-4 w-4" /> Bewertung berechnen
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Valuation Results */}
      {step === "results" && parsedData && valuation && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase mb-1">
                <BadgePercent className="h-3 w-3" /> Ertragswertverfahren
              </div>
              <div className="text-xl font-bold">{formatCurrency(valuation.ertragswert)}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Basierend auf Mieteinnahmen</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-[9px] text-muted-foreground/60 mt-2 cursor-help">
                    Jahresreinertrag: {formatCurrency(valuation.jahresReinertrag)} · Vervielfältiger: {valuation.vervielfaeltiger.toFixed(2)}
                  </p>
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[250px]">
                  <p>Ertragswert = Bodenwert + (Gebäudereinertrag × Vervielfältiger)</p>
                  <p className="mt-1">Bodenwert: {formatCurrency(valuation.bodenwert)}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase mb-1">
                <Landmark className="h-3 w-3" /> Sachwertverfahren
              </div>
              <div className="text-xl font-bold">{formatCurrency(valuation.sachwert)}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Basierend auf Herstellungskosten</p>
              <p className="text-[9px] text-muted-foreground/60 mt-2">
                HK: {formatCurrency(valuation.herstellungskosten)} · Altersm.: {(valuation.altersminderung * 100).toFixed(0)}%
              </p>
            </div>

            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase mb-1">
                <Sparkles className="h-3 w-3" /> Vergleichswertverfahren
              </div>
              <div className="text-xl font-bold">{formatCurrency(valuation.vergleichswert)}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Basierend auf Marktvergleich</p>
              <p className="text-[9px] text-muted-foreground/60 mt-2">
                BRW: {params.bodenrichtwert} €/m² · Faktor: {valuation.brwToPrice}x
              </p>
            </div>
          </div>

          {/* Combined result */}
          <div className="gradient-card rounded-xl border-2 border-primary/30 p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Geschätzter Marktwert (Durchschnitt)</div>
                <div className="text-3xl font-bold text-primary mt-1">{formatCurrency(valuation.durchschnitt)}</div>
              </div>
              {changeVsKauf !== null && (
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">vs. Kaufpreis ({formatCurrency(parsedData.kaufpreis)})</div>
                  <div className={`text-xl font-bold ${changeVsKauf >= 0 ? "text-profit" : "text-loss"}`}>
                    {changeVsKauf >= 0 ? "+" : ""}{formatPercent(changeVsKauf)}
                  </div>
                </div>
              )}
            </div>
            {params.bodenrichtwert > 0 && (
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Bodenrichtwert: {params.bodenrichtwert} €/m² · Bodenwert: {formatCurrency(valuation.bodenwert)}
              </div>
            )}
            {parsedData.wohnflaeche > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Wert pro m²: {formatCurrency(Math.round(valuation.durchschnitt / parsedData.wohnflaeche))} · Wohnfläche: {parsedData.wohnflaeche} m²
              </div>
            )}
          </div>

          {/* Sparkasse comparison section */}
          <div className="gradient-card rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-loss" />
              <h3 className="text-sm font-semibold">Sparkasse S-ImmoPreisfinder — Vergleichsbewertung</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Fordern Sie eine kostenlose Vergleichsbewertung der Sparkasse Barnim an.
              Sie erhalten per E-Mail eine professionelle Wohnmarktanalyse vom iib Institut, die Sie mit unserer Bewertung vergleichen können.
            </p>

            {sparkasseRequested ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-profit/5 border border-profit/20">
                <CheckCircle2 className="h-5 w-5 text-profit shrink-0" />
                <div>
                  <p className="text-sm font-medium">Sparkasse-Bewertung angefordert</p>
                  <p className="text-xs text-muted-foreground">
                    Der S-ImmoPreisfinder wurde geöffnet. Bitte füllen Sie das Formular aus.
                    {sparkasseEmail && <> Die Wohnmarktanalyse wird an <strong>{sparkasseEmail}</strong> gesendet.</>}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">E-Mail für Sparkasse-Bericht</Label>
                  <Input
                    type="email"
                    value={sparkasseEmail}
                    onChange={e => setSparkasseEmail(e.target.value)}
                    placeholder="ihre@email.de"
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSparkasseRequest}
                  disabled={sparkasseLoading || !sparkasseEmail}
                  className="gap-1.5 shrink-0 text-xs h-8"
                >
                  {sparkasseLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                  S-ImmoPreisfinder öffnen
                </Button>
              </div>
            )}

            {/* Pre-filled data summary for Sparkasse form */}
            {!sparkasseRequested && parsedData && (
              <div className="text-[10px] text-muted-foreground p-2 rounded bg-secondary/30">
                <strong>Daten für das Sparkasse-Formular:</strong>{" "}
                Typ: {SPARKASSE_TYPES[parsedData.immobilientyp]} · {parsedData.address || "—"} ·{" "}
                {parsedData.wohnflaeche > 0 ? `${parsedData.wohnflaeche} m²` : "—"} ·{" "}
                Bj. {parsedData.baujahr > 0 ? parsedData.baujahr : "—"}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setStep("review")}>
              Daten bearbeiten
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleDownloadPdf}>
              <Download className="h-3.5 w-3.5" /> PDF-Bericht herunterladen
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Hinweis: Schätzwerte basierend auf vereinfachten Normverfahren. Für rechtsverbindliche Bewertungen bitte einen zertifizierten Sachverständigen beauftragen.
            Bodenrichtwerte sind Näherungswerte basierend auf regionalen Durchschnittsdaten.
          </p>
        </div>
      )}
    </div>
  );
};

export default ImmobilienBewertung;
