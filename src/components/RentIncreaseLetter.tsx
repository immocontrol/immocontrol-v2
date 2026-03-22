import { useState, useCallback, useMemo } from "react";
import { FileText, Download, AlertTriangle, CheckCircle2, Info, Sparkles, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { formatCurrency, sanitizeForPdf } from "@/lib/formatters";
import { generateRentIncreaseJustification, isDeepSeekConfigured, improveText } from "@/integrations/ai/extractors";
import { loadJsPDF } from "@/lib/lazyImports";

/** Feature 3: Mietspiegel-Referenzdaten für größere deutsche Städte */
const MIETSPIEGEL_DATA: Record<string, { min: number; max: number; avg: number; year: number }> = {
  "berlin": { min: 6.50, max: 13.50, avg: 9.80, year: 2024 },
  "münchen": { min: 12.00, max: 22.00, avg: 16.50, year: 2023 },
  "hamburg": { min: 8.50, max: 16.00, avg: 11.80, year: 2023 },
  "köln": { min: 7.50, max: 14.00, avg: 10.50, year: 2024 },
  "frankfurt": { min: 9.00, max: 17.00, avg: 13.00, year: 2024 },
  "düsseldorf": { min: 8.00, max: 15.00, avg: 11.00, year: 2023 },
  "stuttgart": { min: 9.50, max: 16.50, avg: 12.80, year: 2023 },
  "dortmund": { min: 5.50, max: 10.00, avg: 7.50, year: 2023 },
  "essen": { min: 5.50, max: 9.50, avg: 7.20, year: 2023 },
  "leipzig": { min: 5.50, max: 10.50, avg: 7.80, year: 2024 },
  "dresden": { min: 5.50, max: 10.00, avg: 7.50, year: 2023 },
  "hannover": { min: 6.50, max: 12.00, avg: 9.00, year: 2023 },
  "nürnberg": { min: 7.00, max: 13.00, avg: 9.80, year: 2023 },
  "bremen": { min: 6.00, max: 11.00, avg: 8.50, year: 2023 },
  "freiburg": { min: 8.50, max: 15.00, avg: 11.50, year: 2024 },
  "potsdam": { min: 7.00, max: 12.50, avg: 9.50, year: 2023 },
};

/** Feature 3: Ballungsräume mit 15% Kappungsgrenze */
const BALLUNGSRAEUME = [
  "berlin", "münchen", "hamburg", "köln", "frankfurt", "düsseldorf", "stuttgart",
  "freiburg", "potsdam", "heidelberg", "münster", "bonn", "darmstadt", "mainz",
  "augsburg", "regensburg", "konstanz", "tübingen", "rosenheim",
];

export function RentIncreaseLetter() {
  const [landlord, setLandlord] = useState({ name: "", address: "" });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [currentRent, setCurrentRent] = useState(0);
  const [newRent, setNewRent] = useState(0);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("Anpassung an die ortsübliche Vergleichsmiete gemäß § 558 BGB");
  const [mietspiegelRef, setMietspiegelRef] = useState("");
  const [city, setCity] = useState("none");
  const [sqm, setSqm] = useState(0);
  const [isBallungsraum, setIsBallungsraum] = useState(false);

  const mietspiegelInfo = useMemo(() => {
    if (!city || city === "none") return null;
    const key = city.toLowerCase().trim();
    return MIETSPIEGEL_DATA[key] || null;
  }, [city]);

  const kappungsgrenze = useMemo(() => {
    const key = city && city !== "none" ? city.toLowerCase().trim() : "";
    return isBallungsraum || BALLUNGSRAEUME.includes(key) ? 15 : 20;
  }, [city, isBallungsraum]);

  const increase = currentRent > 0 ? ((newRent - currentRent) / currentRent * 100) : 0;
  const isOverKappung = increase > kappungsgrenze;
  const isOver20 = increase > 20;
  const isOver15 = increase > 15;

  const rentPerSqm = sqm > 0 ? newRent / sqm : 0;
  const isInMietspiegel = mietspiegelInfo ? (rentPerSqm >= mietspiegelInfo.min && rentPerSqm <= mietspiegelInfo.max) : null;

  /** Feature 3: Generate real PDF using jsPDF (lazy loaded) */
  const exportPDF = useCallback(async () => {
    if (!tenantName || !currentRent || !newRent || !effectiveDate) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    const JsPDF = await loadJsPDF();
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
    const doc = new JsPDF({ format: "a4" });
    const margin = 25;
    let y = margin;

    // Header
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(sanitizeForPdf(landlord.name || "[Vermieter Name]"), margin, y); y += 5;
    doc.text(sanitizeForPdf(landlord.address || "[Adresse]"), margin, y); y += 12;
    doc.text(sanitizeForPdf(tenantName), margin, y); y += 5;
    doc.text(sanitizeForPdf(tenantAddress || "[Mieteradresse]"), margin, y); y += 12;

    // Date right-aligned
    doc.text(sanitizeForPdf(today), 190 - doc.getTextWidth(sanitizeForPdf(today)), y); y += 15;

    // Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(sanitizeForPdf("Mieterhöhungsverlangen gemäß § 558 BGB"), margin, y); y += 12;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(sanitizeForPdf(`Sehr geehrte/r ${tenantName},`), margin, y); y += 8;
    const intro = doc.splitTextToSize(sanitizeForPdf("hiermit erlaube ich mir, Sie um Ihre Zustimmung zur Erhöhung der Nettokaltmiete zu bitten."), 160);
    doc.text(intro, margin, y); y += intro.length * 5 + 8;

    // Highlight box
    doc.setDrawColor(42, 157, 110);
    doc.setFillColor(240, 249, 244);
    doc.roundedRect(margin, y - 2, 160, 28, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.text(sanitizeForPdf(`Aktuelle Miete: ${formatCurrency(currentRent)} / Monat`), margin + 4, y + 5);
    doc.text(sanitizeForPdf(`Neue Miete: ${formatCurrency(newRent)} / Monat`), margin + 4, y + 11);
    doc.text(sanitizeForPdf(`Erhöhung: ${formatCurrency(newRent - currentRent)} (${increase.toFixed(1)}%)`), margin + 4, y + 17);
    doc.text(sanitizeForPdf(`Wirksam ab: ${new Date(effectiveDate).toLocaleDateString("de-DE")}`), margin + 4, y + 23);
    y += 35;

    doc.setFont("helvetica", "normal");
    doc.setFont("helvetica", "bold");
    doc.text(sanitizeForPdf("Begründung:"), margin, y);
    doc.setFont("helvetica", "normal");
    const reasonLines = doc.splitTextToSize(sanitizeForPdf(reason), 160);
    doc.text(reasonLines, margin + 25, y); y += reasonLines.length * 5 + 6;

    if (mietspiegelRef) {
      doc.setFont("helvetica", "bold");
      doc.text(sanitizeForPdf("Referenz Mietspiegel:"), margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(sanitizeForPdf(mietspiegelRef), margin + 43, y); y += 8;
    }

    if (mietspiegelInfo && sqm > 0) {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(sanitizeForPdf(`Mietspiegel ${city} (${mietspiegelInfo.year}): ${mietspiegelInfo.min.toFixed(2)}-${mietspiegelInfo.max.toFixed(2)} EUR/m² · Neue Miete: ${rentPerSqm.toFixed(2)} EUR/m²`), margin, y);
      doc.setTextColor(0);
      doc.setFontSize(10);
      y += 8;
    }

    if (isOverKappung) {
      doc.setFillColor(255, 243, 224);
      doc.roundedRect(margin, y - 2, 160, 12, 2, 2, "F");
      doc.setFontSize(9);
      doc.setTextColor(200, 100, 0);
      doc.text(sanitizeForPdf(`Hinweis: Die Erhöhung überschreitet die Kappungsgrenze von ${kappungsgrenze}% (§ 558 Abs. 3 BGB).`), margin + 4, y + 5);
      doc.setTextColor(0);
      doc.setFontSize(10);
      y += 16;
    }

    const closingText = doc.splitTextToSize(
      sanitizeForPdf("Gemäß § 558b BGB bitte ich Sie, Ihre Zustimmung innerhalb von zwei Monaten nach Zugang dieses Schreibens zu erklären. Die erhöhte Miete wird ab dem dritten Kalendermonat nach Zugang dieses Verlangens fällig."),
      160
    );
    doc.text(closingText, margin, y); y += closingText.length * 5 + 8;
    doc.text(sanitizeForPdf("Für Rückfragen stehe ich Ihnen gerne zur Verfügung."), margin, y); y += 10;
    doc.text(sanitizeForPdf("Mit freundlichen Grüßen"), margin, y); y += 20;
    doc.text("_________________________________", margin, y); y += 6;
    doc.text(sanitizeForPdf(`${landlord.name || "[Vermieter]"}, ${today}`), margin, y);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(sanitizeForPdf("Erstellt mit ImmoControl · Mieterhöhungsverlangen nach § 558 BGB"), margin, 285);

    doc.save(`Mieterhoehung_${tenantName.replace(/\s+/g, "_")}_${effectiveDate}.pdf`);
    toast.success("Mieterhöhungsschreiben als PDF erstellt!");
  }, [landlord, tenantName, tenantAddress, currentRent, newRent, effectiveDate, reason, mietspiegelRef, increase, isOverKappung, kappungsgrenze, city, mietspiegelInfo, sqm, rentPerSqm]);

  const runGenerateJustification = useCallback(async () => {
    setAiGenerating(true);
    try {
      const text = await generateRentIncreaseJustification({
        propertyName: tenantAddress || tenantName || "Mietsache",
        currentRent,
        newRent,
        increasePct: increase,
      });
      setReason(text);
      toast.success("Begründung generiert");
    } catch (e: unknown) {
      handleError(e, { context: "general", showToast: false });
      const msg = e instanceof Error ? e.message : "Begründung konnte nicht generiert werden";
      toastErrorWithRetry(msg, () => runGenerateJustification());
    } finally {
      setAiGenerating(false);
    }
  }, [tenantAddress, tenantName, currentRent, newRent, increase]);

  const runImproveText = useCallback(async () => {
    setAiImproving(true);
    try {
      const improved = await improveText(reason, "Begründung für Mieterhöhung gemäß § 558 BGB");
      setReason(improved);
      toast.success("Text verbessert");
    } catch (e: unknown) {
      handleError(e, { context: "general", showToast: false });
      const msg = e instanceof Error ? e.message : "Verbessern fehlgeschlagen";
      toastErrorWithRetry(msg, () => runImproveText());
    } finally {
      setAiImproving(false);
    }
  }, [reason]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Mieterhöhung
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Mieterhöhungsschreiben
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vermieter Name</Label>
              <Input value={landlord.name} onChange={e => setLandlord({...landlord, name: e.target.value})} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vermieter Adresse</Label>
              <Input value={landlord.address} onChange={e => setLandlord({...landlord, address: e.target.value})} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mieter Name *</Label>
              <Input value={tenantName} onChange={e => setTenantName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mieter Adresse</Label>
              <Input value={tenantAddress} onChange={e => setTenantAddress(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Aktuelle Miete € *</Label>
              <Input type="number" value={currentRent || ""} onChange={e => setCurrentRent(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Neue Miete € *</Label>
              <Input type="number" value={newRent || ""} onChange={e => setNewRent(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Wirksam ab *</Label>
              <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Feature 3: Mietspiegel-Integration */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Stadt (für Mietspiegel)</Label>
              <Select value={city} onValueChange={v => setCity(v === "none" ? "none" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Stadt wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine</SelectItem>
                  {Object.keys(MIETSPIEGEL_DATA).map(c => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Wohnfläche m²</Label>
              <Input type="number" value={sqm || ""} onChange={e => setSqm(Number(e.target.value))} className="h-9 text-sm" placeholder="z.B. 65" />
            </div>
            <div className="space-y-1 flex items-end">
              <label className="flex items-center gap-1.5 h-9 cursor-pointer">
                <input type="checkbox" checked={isBallungsraum} onChange={e => setIsBallungsraum(e.target.checked)} className="rounded" />
                <span className="text-xs">Ballungsraum (15%)</span>
              </label>
            </div>
          </div>

          {/* Mietspiegel Info */}
          {mietspiegelInfo && (
            <div className="rounded-lg p-3 text-xs bg-primary/5 border border-primary/20 space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <Info className="h-3.5 w-3.5 text-primary" />
                Mietspiegel {city.charAt(0).toUpperCase() + city.slice(1)} ({mietspiegelInfo.year})
              </div>
              <div className="flex justify-between"><span>Spanne:</span><span>{mietspiegelInfo.min.toFixed(2)} – {mietspiegelInfo.max.toFixed(2)} €/m²</span></div>
              <div className="flex justify-between"><span>Durchschnitt:</span><span>{mietspiegelInfo.avg.toFixed(2)} €/m²</span></div>
              {sqm > 0 && newRent > 0 && (
                <div className={`flex justify-between font-medium ${isInMietspiegel ? "text-profit" : "text-loss"}`}>
                  <span>Neue Miete/m²:</span>
                  <span>{rentPerSqm.toFixed(2)} €/m² {isInMietspiegel ? "✓ im Mietspiegel" : rentPerSqm > (mietspiegelInfo?.max ?? 0) ? "⚠ über Mietspiegel" : "⚠ unter Mietspiegel"}</span>
                </div>
              )}
            </div>
          )}

          {/* Kappungsgrenze Preview */}
          {currentRent > 0 && newRent > 0 && (
            <div className={`rounded-lg p-3 text-xs space-y-1 ${isOverKappung ? "bg-loss/10 border border-loss/20" : isOver15 ? "bg-gold/10 border border-gold/20" : "bg-profit/10 border border-profit/20"}`}>
              <div className="flex justify-between">
                <span>Erhöhung:</span>
                <span className="font-bold">{formatCurrency(newRent - currentRent)} ({increase.toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Kappungsgrenze:</span>
                <span>{kappungsgrenze}% {BALLUNGSRAEUME.includes(city.toLowerCase().trim()) ? "(Ballungsraum)" : "(Standard)"}</span>
              </div>
              {isOverKappung && (
                <p className="text-loss font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Überschreitet {kappungsgrenze}% Kappungsgrenze!
                </p>
              )}
              {!isOverKappung && (
                <p className="text-profit font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Im Rahmen der Kappungsgrenze ({kappungsgrenze}%)
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs">Begründung</Label>
              {isDeepSeekConfigured() && (
                <div className="flex gap-1">
                  {currentRent > 0 && newRent > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={aiGenerating || aiImproving}
                    onClick={() => runGenerateJustification()}
                  >
                    {aiGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    KI-Begründung
                  </Button>
                  )}
                  {reason.trim().length >= 10 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={aiGenerating || aiImproving}
                      onClick={() => runImproveText()}
                    >
                      {aiImproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenLine className="h-3 w-3" />}
                      Verbessern
                    </Button>
                  )}
                </div>
              )}
            </div>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} className="text-xs min-h-[60px]" placeholder="Anpassung an die ortsübliche Vergleichsmiete gemäß § 558 BGB" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Mietspiegel-Referenz (optional)</Label>
            <Input value={mietspiegelRef} onChange={e => setMietspiegelRef(e.target.value)} className="h-9 text-sm" placeholder="z.B. Mietspiegel München 2024, Kategorie III" />
          </div>

          <Button onClick={exportPDF} className="w-full gap-1.5">
            <Download className="h-4 w-4" /> Als PDF herunterladen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
