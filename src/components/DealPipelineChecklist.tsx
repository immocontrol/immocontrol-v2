/**
 * Pipeline-Templates + Checklisten für Deals
 * Pro Deal-Typ (Sanierungsfall, Neubau, Bestandsvermietung) und Stage angepasste Checklisten.
 */
import { useState, useEffect, useCallback } from "react";
import { Check, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const DEAL_TYPES = [
  { key: "etw", label: "Eigentumswohnung" },
  { key: "mfh", label: "Mehrfamilienhaus" },
  { key: "sanierung", label: "Sanierungsfall" },
  { key: "neubau", label: "Neubau" },
  { key: "gewerbe", label: "Gewerbeimmobilie" },
] as const;

const TEMPLATES: Record<string, Record<string, string[]>> = {
  etw: {
    recherche: ["Exposé gesichtet", "Preisrecherche (Vergleichsobjekte)", "Lage geprüft"],
    kontaktiert: ["Anfrage gesendet", "Antwort erhalten"],
    besichtigung: ["Termin vereinbart", "Besichtigung durchgeführt", "Zustand dokumentiert"],
    angebot: ["Kaufpreis verhandelt", "Nebenkosten berechnet", "Finanzierung geklärt"],
    verhandlung: ["Notartermin geplant", "Unterlagen vollständig"],
    abgeschlossen: ["Kaufvertrag unterschrieben", "Übergabe durchgeführt"],
  },
  mfh: {
    recherche: ["Exposé gesichtet", "Mietverträge geprüft", "Bausubstanz recherchiert"],
    kontaktiert: ["Makler/Eigentümer kontaktiert", "Erste Infos erhalten"],
    besichtigung: ["Termin vereinbart", "Alle Einheiten besichtigt", "Technik (Heizung, Dach) geprüft"],
    angebot: ["Kaufpreis verhandelt", "NK-Abrechnungen geprüft", "Bank angefragt"],
    verhandlung: ["Unterlagen vollständig", "Notartermin"],
    abgeschlossen: ["Kaufvertrag", "Übergabe"],
  },
  sanierung: {
    recherche: ["Exposé gesichtet", "Sanierungsaufwand grob geschätzt", "Baukosten recherchiert"],
    kontaktiert: ["Kontakt hergestellt", "Gutachten angefordert"],
    besichtigung: ["Besichtigung", "Handwerker-Kostenschätzung", "Baurecht geprüft"],
    angebot: ["Gesamtkosten kalkuliert", "Rendite nach Sanierung berechnet", "Finanzierung (inkl. Sanierung)"],
    verhandlung: ["Sanierungsplan erstellt", "Bank-Freigabe"],
    abgeschlossen: ["Kauf", "Sanierung geplant"],
  },
  neubau: {
    recherche: ["Projekt gesichtet", "Bauphase/Preise geprüft"],
    kontaktiert: ["Bauträger kontaktiert", "Unterlagen angefordert"],
    besichtigung: ["Musterwohnung/Musterhaus", "Qualität geprüft"],
    angebot: ["Preis verhandelt", "Sonderwünsche geklärt", "Finanzierung"],
    verhandlung: ["Bauvertrag geprüft", "Abschlagsplan"],
    abgeschlossen: ["Unterschrieben", "Auszahlungsplan"],
  },
  gewerbe: {
    recherche: ["Exposé gesichtet", "Mietvertrag/Bestandsmiete geprüft"],
    kontaktiert: ["Vermieter/Verwalter kontaktiert"],
    besichtigung: ["Objekt besichtigt", "Gewerbeeinheit geprüft"],
    angebot: ["Kaufpreis", "Mietvertragslaufzeit", "Leerstandsrisiko"],
    verhandlung: ["Unterlagen", "Due Diligence"],
    abgeschlossen: ["Kauf", "Übergabe"],
  },
};

const STORAGE_KEY = "immo_deal_checklist_";

interface DealPipelineChecklistProps {
  dealId: string;
  stage: string;
  propertyType?: string;
  compact?: boolean;
}

function getDealType(propertyType?: string): string {
  const t = (propertyType || "etw").toLowerCase();
  if (t.includes("sanier") || t === "sanierung") return "sanierung";
  if (t.includes("neubau")) return "neubau";
  if (t.includes("gewerbe") || t === "gewerbe") return "gewerbe";
  if (t.includes("mfh") || t.includes("haus")) return "mfh";
  return "etw";
}

export function DealPipelineChecklist({ dealId, stage, propertyType, compact }: DealPipelineChecklistProps) {
  const dealType = getDealType(propertyType);
  const template = TEMPLATES[dealType] ?? TEMPLATES.etw;
  const items = template[stage] ?? template.recherche ?? [];
  const key = `${STORAGE_KEY}${dealId}`;

  const [stored, setStored] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(!compact);

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, boolean>;
      const forStage: Record<string, boolean> = {};
      items.forEach((item) => {
        const k = `${stage}:${item}`;
        if (k in all) forStage[item] = all[k];
      });
      setStored(forStage);
    } catch {
      setStored({});
    }
  }, [dealId, stage, key, items.join(",")]);

  const toggle = useCallback((item: string) => {
    const k = `${stage}:${item}`;
    setStored((prev) => {
      const next = { ...prev, [item]: !prev[item] };
      try {
        const all = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, boolean>;
        all[k] = next[item];
        localStorage.setItem(key, JSON.stringify(all));
      } catch { /* noop */ }
      return next;
    });
  }, [stage, key]);

  const done = Object.values(stored).filter(Boolean).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (items.length === 0) return null;

  if (compact) {
    return (
      <div className="surface-section p-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-2 text-left text-xs"
        >
          <span className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5 text-primary" />
            Checkliste ({done}/{total})
          </span>
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {open && (
          <ul className="mt-2 space-y-1">
            {items.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Checkbox
                  checked={!!stored[item]}
                  onCheckedChange={() => toggle(item)}
                />
                <span className={cn("text-[11px]", stored[item] && "line-through text-muted-foreground")}>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        Pipeline-Checkliste
      </h3>
      <p className="text-[10px] text-muted-foreground mb-2">
        {DEAL_TYPES.find(d => d.key === dealType)?.label ?? "ETW"} · Stage: {stage}
      </p>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item}>
            <label className="flex items-center gap-2 cursor-pointer rounded p-1.5 hover:bg-muted/50 text-xs">
              <Checkbox checked={!!stored[item]} onCheckedChange={() => toggle(item)} />
              <span className={cn(stored[item] && "line-through text-muted-foreground")}>{item}</span>
              {stored[item] && <Check className="h-3 w-3 text-profit shrink-0" />}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
