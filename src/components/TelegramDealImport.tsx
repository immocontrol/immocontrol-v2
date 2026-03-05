import { useState, useCallback } from "react";
import { MessageSquare, Upload, Check, AlertTriangle, X, Copy, Clipboard, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

/* UPD-1: Telegram message parser for immometrica deal feed format */

/** Parsed deal from a Telegram message block */
export interface ParsedTelegramDeal {
  title: string;
  address: string;
  propertyType: string;
  buildYear: number | null;
  price: number | null;
  sqm: number | null;
  rooms: string | null;
  plotSqm: number | null;
  pricePerSqm: number | null;
  roi: number | null;
  marketValueDiff: string | null;
  source: string;
  isNew: boolean;
  isReinstated: boolean;
  offlineSince: string | null;
  searchProfile: string;
  rawText: string;
}

/** Parse a single deal block from an immometrica Telegram message */
function parseSingleDeal(block: string, searchProfile: string, isNew: boolean, isReinstated: boolean): ParsedTelegramDeal | null {
  const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  /* UPD-2: Extract title — first non-empty line that is not a tag/emoji prefix */
  let title = "";
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].replace(/^[\u2728\u2b50\u2705\s]+/u, "").trim();
    if (cleaned === "Neu" || cleaned === "Als Favorit speichern") continue;
    if (cleaned.length > 5 && !cleaned.startsWith("War offline")) {
      title = cleaned;
      startIdx = i + 1;
      break;
    }
  }
  if (!title) return null;

  /* UPD-3: Extract structured fields from remaining lines */
  let address = "";
  let propertyType = "";
  let buildYear: number | null = null;
  let price: number | null = null;
  let sqm: number | null = null;
  let rooms: string | null = null;
  let plotSqm: number | null = null;
  let pricePerSqm: number | null = null;
  let roi: number | null = null;
  let marketValueDiff: string | null = null;
  let source = "Telegram";
  let offlineSince: string | null = null;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();

    /* Address line: contains postal code (5 digits) */
    if (/\d{5}/.test(line) && !line.includes("€") && !line.includes("%") && !line.includes("m²")) {
      address = line;
      continue;
    }

    /* Property type + build year: "Mehrfamilienhaus - Bauj. 1956" */
    const typeMatch = line.match(/^(.+?)\s*-\s*Bauj\.\s*(\d{4})/);
    if (typeMatch) {
      propertyType = typeMatch[1].trim();
      buildYear = parseInt(typeMatch[2]);
      continue;
    }

    /* Offline since: "War offline seit 27.02.2026" */
    const offlineMatch = line.match(/War offline seit (.+)/);
    if (offlineMatch) {
      offlineSince = offlineMatch[1].trim();
      continue;
    }

    /* Price, sqm, rooms line: "750.000 € | 785.0 m² | - Zi." */
    const priceLine = line.match(/([\d.,]+)\s*€\s*\|\s*([\d.,]+)\s*m²\s*\|\s*([\d-]+)\s*Zi/);
    if (priceLine) {
      price = parseGermanNumber(priceLine[1]);
      sqm = parseGermanNumber(priceLine[2]);
      rooms = priceLine[3] === "-" ? null : priceLine[3];
      continue;
    }

    /* Plot size: "1100.0 m² Grundstück" or "- m² Grundstück" */
    const plotMatch = line.match(/([\d.,]+)\s*m²\s*Grundstück/);
    if (plotMatch) {
      plotSqm = parseGermanNumber(plotMatch[1]);
      continue;
    }

    /* Price per sqm: "955 €/m²" */
    const psmMatch = line.match(/([\d.,]+)\s*€\/m²/);
    if (psmMatch) {
      pricePerSqm = parseGermanNumber(psmMatch[1]);
      continue;
    }

    /* ROI: "13,5 % ROI" */
    const roiMatch = line.match(/([\d.,]+)\s*%\s*ROI/);
    if (roiMatch) {
      roi = parseGermanNumber(roiMatch[1]);
      continue;
    }

    /* Market value diff: "-44,2 % Marktwert" */
    const mvMatch = line.match(/(-?[\d.,]+)\s*%\s*Marktwert/);
    if (mvMatch) {
      /* FIX-1: Use global /,/g to replace ALL commas */
      marketValueDiff = mvMatch[1].replace(/,/g, ".") + "%";
      continue;
    }

    /* Source: "ImmoScout", "Immowelt", etc. */
    if (/^(ImmoScout|Immowelt|eBay|Kleinanzeigen|Immobilienscout|immoscout)/i.test(line)) {
      source = line.trim();
      continue;
    }
  }

  /* UPD-4: Fallback — if no address found, use the location from title */
  if (!address && title) {
    const plzMatch = title.match(/\d{5}\s*,?\s*\w+/);
    if (plzMatch) address = plzMatch[0];
  }

  return {
    title,
    address,
    propertyType,
    buildYear,
    price,
    sqm,
    rooms,
    plotSqm,
    pricePerSqm,
    roi,
    marketValueDiff,
    source,
    isNew,
    isReinstated,
    offlineSince,
    searchProfile,
    rawText: block.trim(),
  };
}

/** Parse German number format: "750.000" → 750000, "785.0" → 785, "13,5" → 13.5 */
function parseGermanNumber(str: string): number | null {
  if (!str || str === "-") return null;
  /* Handle German format: dots as thousand separators, comma as decimal */
  const cleaned = str.replace(/\s/g, "");
  /* If there's both dot and comma, dot is thousand separator */
  if (cleaned.includes(",") && cleaned.includes(".")) {
    /* FIX-1: Use global /,/g to replace ALL commas */
    return parseFloat(cleaned.replace(/\./g, "").replace(/,/g, "."));
  }
  /* If only comma, it's a decimal separator */
  if (cleaned.includes(",")) {
    /* FIX-1: Use global /,/g to replace ALL commas */
    return parseFloat(cleaned.replace(/,/g, "."));
  }
  /* If only dots: check if it's a thousand separator or decimal */
  /* "750.000" → 750000 (thousand sep), "785.0" → 785 (decimal) */
  const parts = cleaned.split(".");
  if (parts.length >= 2 && parts.slice(1).every(p => p.length === 3)) {
    /* Thousand separator: "750.000" or "2.850.000" */
    return parseFloat(cleaned.replace(/\./g, ""));
  }
  return parseFloat(cleaned);
}

/** UPD-5: Parse multiple deals from a full Telegram message dump */
export function parseTelegramMessages(text: string): ParsedTelegramDeal[] {
  const deals: ParsedTelegramDeal[] = [];

  /* Split on search profile headers */
  const sections = text.split(/(?="[^"]+":)/);

  for (const section of sections) {
    /* Extract search profile name: "MFH Speckgürtel Berlin bis 10 Mio" */
    const profileMatch = section.match(/"([^"]+)":\s*(.*?)(?:\n|$)/);
    const searchProfile = profileMatch ? profileMatch[1] : "Unbekannt";
    const headerLine = profileMatch ? profileMatch[2].trim() : "";

    const isReinstated = /Wiedereingestellt/i.test(headerLine);
    const isNew = /Neue Objekte/i.test(headerLine) || /\u2728\s*Neu/u.test(section);

    /* Split into individual deal blocks on the star/favorite marker or double newline */
    const dealBlocks = section.split(/\u2b50\s*Als Favorit speichern/u);

    for (const block of dealBlocks) {
      /* Skip the header-only block */
      if (!block.includes("€") && !block.includes("m²")) continue;

      /* Further split if there are multiple "Neu" markers */
      const subBlocks = block.split(/\u2728\s*Neu\s*\n/u);
      for (const sub of subBlocks) {
        if (!sub.includes("€")) continue;
        const parsed = parseSingleDeal(sub, searchProfile, isNew, isReinstated);
        if (parsed) deals.push(parsed);
      }
    }
  }

  /* UPD-6: Deduplicate by address+price combination */
  const seen = new Set<string>();
  return deals.filter(d => {
    const key = `${d.title}|${d.address}|${d.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** UPD-7: Convert parsed Telegram deal to Deals page form format */
export function telegramDealToForm(deal: ParsedTelegramDeal) {
  /* Map property type to form select values */
  const typeMap: Record<string, string> = {
    "Mehrfamilienhaus": "MFH",
    "Einfamilienhaus": "EFH",
    "Eigentumswohnung": "ETW",
    "Wohn-/ Geschäftshaus": "MFH",
    "Wohn- und Geschäftshaus": "MFH",
    "Gewerbe": "Gewerbe",
    "Grundstück": "Grundstück",
  };

  const propertyType = Object.entries(typeMap).find(
    ([key]) => deal.propertyType.toLowerCase().includes(key.toLowerCase())
  )?.[1] || "MFH";

  /* Build description with all metadata */
  const descParts: string[] = [];
  if (deal.buildYear) descParts.push(`Baujahr: ${deal.buildYear}`);
  if (deal.roi) descParts.push(`ROI: ${deal.roi}%`);
  if (deal.marketValueDiff) descParts.push(`Marktwert: ${deal.marketValueDiff}`);
  if (deal.pricePerSqm) descParts.push(`${deal.pricePerSqm} €/m²`);
  if (deal.plotSqm) descParts.push(`Grundstück: ${deal.plotSqm} m²`);
  if (deal.offlineSince) descParts.push(`Offline seit: ${deal.offlineSince}`);
  if (deal.isReinstated) descParts.push("Wiedereingestellt");
  if (deal.searchProfile) descParts.push(`Suchprofil: ${deal.searchProfile}`);

  return {
    title: deal.title.substring(0, 100),
    address: deal.address,
    description: descParts.join(" | "),
    stage: "recherche",
    purchase_price: deal.price || 0,
    expected_rent: 0,
    sqm: deal.sqm || 0,
    units: 1,
    property_type: propertyType,
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    source: `Telegram (${deal.source})`,
    notes: deal.rawText,
    lost_reason: "",
  };
}

interface TelegramDealImportProps {
  onImportDeals: (deals: ReturnType<typeof telegramDealToForm>[]) => void;
}

/** UPD-8: Telegram Deal Import Dialog Component */
export const TelegramDealImport = ({ onImportDeals }: TelegramDealImportProps) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedTelegramDeal[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const handleParse = useCallback(() => {
    if (!text.trim()) {
      toast.error("Bitte Telegram-Nachricht einfügen");
      return;
    }
    const results = parseTelegramMessages(text);
    if (results.length === 0) {
      toast.error("Keine Deals in der Nachricht gefunden");
      return;
    }
    setParsed(results);
    setSelected(new Set(results.map((_, i) => i)));
    toast.success(`${results.length} Deal${results.length > 1 ? "s" : ""} erkannt`);
  }, [text]);

  const handleImport = useCallback(() => {
    const selectedDeals = parsed
      .filter((_, i) => selected.has(i))
      .map(d => telegramDealToForm(d));
    if (selectedDeals.length === 0) {
      toast.error("Keine Deals ausgewählt");
      return;
    }
    onImportDeals(selectedDeals);
    setOpen(false);
    setText("");
    setParsed([]);
    setSelected(new Set());
  }, [parsed, selected, onImportDeals]);

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handlePaste = useCallback(async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setText(clipText);
        toast.success("Aus Zwischenablage eingefügt");
      }
    } catch {
      toast.error("Kein Zugriff auf die Zwischenablage");
    }
  }, []);

  const fmtPrice = (n: number | null) => {
    if (!n) return "–";
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  };

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setParsed([]); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Telegram Import</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Deals aus Telegram importieren
          </DialogTitle>
        </DialogHeader>

        {parsed.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Kopiere die Telegram-Nachrichten von deinem immometrica Deal-Feed und füge sie hier ein.
              Der Parser erkennt automatisch Adresse, Preis, Fläche, ROI und weitere Details.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePaste} className="gap-1.5">
                <Clipboard className="h-3.5 w-3.5" /> Einfügen
              </Button>
            </div>
            <Textarea
              placeholder={'Telegram-Nachricht hier einfügen...\n\nBeispiel:\n"MFH Speckgürtel Berlin bis 10 Mio": Neue Objekte (28.02.2026)\n\n\u2728 Neu\nMehrfamilienhaus mit 12 WE\n14513, Teltow\nMehrfamilienhaus - Bauj. 2020\n2.850.000 \u20ac | 980.0 m\u00b2 | - Zi.\n...'}
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
            <Button onClick={handleParse} disabled={!text.trim()} className="w-full gap-1.5">
              <Upload className="h-4 w-4" /> Deals erkennen
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {parsed.length} Deal{parsed.length > 1 ? "s" : ""} erkannt — {selected.size} ausgewählt
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(parsed.map((_, i) => i)))}>
                  Alle
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Keine
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setParsed([]); setText(""); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Zurück
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {parsed.map((deal, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleSelect(idx)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected.has(idx)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selected.has(idx) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                    }`}>
                      {selected.has(idx) && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{deal.title}</p>
                        {deal.isNew && <Badge variant="default" className="text-[10px] h-4">Neu</Badge>}
                        {deal.isReinstated && <Badge variant="secondary" className="text-[10px] h-4">Wiedereingestellt</Badge>}
                      </div>
                      {deal.address && (
                        <p className="text-xs text-muted-foreground mt-0.5">{deal.address}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {deal.price && <span className="text-xs font-medium">{fmtPrice(deal.price)}</span>}
                        {deal.sqm && <span className="text-xs text-muted-foreground">{deal.sqm} m²</span>}
                        {deal.roi && <Badge variant="outline" className="text-[10px] h-4">{deal.roi}% ROI</Badge>}
                        {deal.propertyType && <span className="text-xs text-muted-foreground">{deal.propertyType}</span>}
                        {deal.buildYear && <span className="text-xs text-muted-foreground">Bj. {deal.buildYear}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{deal.source}</span>
                        {deal.marketValueDiff && (
                          <span className={`text-[10px] font-medium ${
                            deal.marketValueDiff.startsWith("-") ? "text-green-600" : "text-red-500"
                          }`}>
                            {deal.marketValueDiff} Marktwert
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleImport} disabled={selected.size === 0} className="w-full gap-1.5">
              <ArrowRight className="h-4 w-4" />
              {selected.size} Deal{selected.size !== 1 ? "s" : ""} importieren
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
