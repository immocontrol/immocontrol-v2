/**
 * Objekt-Checkliste "Finanzierung vorbereiten"
 * Hilft bei der Vorbereitung der Bank-Unterlagen pro Objekt.
 */
import { useState, useEffect, useCallback } from "react";
import { Check, Landmark, Building2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const DEFAULT_ITEMS = [
  { key: "selbstauskunft", label: "Selbstauskunft aktuell", category: "Persönlich" },
  { key: "gehaltsnachweise", label: "Gehaltsnachweise (3 Monate)", category: "Persönlich" },
  { key: "steuerbescheid", label: "Steuerbescheid (letztes Jahr)", category: "Persönlich" },
  { key: "kaufvertrag", label: "Kaufvertrag / Vorvertrag", category: "Objekt" },
  { key: "grundbuchauszug", label: "Grundbuchauszug (aktuell)", category: "Objekt" },
  { key: "wohnflaechenbeschreibung", label: "Wohnflächenbeschreibung", category: "Objekt" },
  { key: "wertgutachten", label: "Wertgutachten / Verkehrswert", category: "Objekt" },
  { key: "mietvertraege", label: "Mietverträge (bei Bestandsimmobilien)", category: "Objekt" },
  { key: "einnahmeuebersicht", label: "Einnahmeübersicht (Miete)", category: "Objekt" },
  { key: "nebenkostenabrechnung", label: "Letzte NK-Abrechnung", category: "Objekt" },
  { key: "energieausweis", label: "Energieausweis", category: "Objekt" },
  { key: "teilschuldverschreibung", label: "Teilschuldverschreibung (bei WEG)", category: "Objekt" },
];

const STORAGE_KEY = "immo_financing_checklist_";

interface PropertyFinancingChecklistProps {
  propertyId: string;
  propertyName?: string;
  compact?: boolean;
}

export function PropertyFinancingChecklist({ propertyId, propertyName, compact }: PropertyFinancingChecklistProps) {
  const [stored, setStored] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const local = localStorage.getItem(`${STORAGE_KEY}${propertyId}`);
      setStored(local ? (JSON.parse(local) as Record<string, boolean>) : {});
    } catch {
      setStored({});
    }
  }, [propertyId]);

  const toggle = useCallback((key: string) => {
    setStored((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(`${STORAGE_KEY}${propertyId}`, JSON.stringify(next));
      return next;
    });
  }, [propertyId]);

  const done = Object.values(stored).filter(Boolean).length;
  const total = DEFAULT_ITEMS.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (compact) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Landmark className="h-4 w-4 text-primary" />
            Finanzierung vorbereiten
          </span>
          <span className="text-xs text-muted-foreground">{done}/{total} ({pct}%)</span>
        </button>
        {open && (
          <ul className="mt-3 space-y-1.5 text-xs">
            {DEFAULT_ITEMS.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                <Checkbox
                  checked={!!stored[item.key]}
                  onCheckedChange={() => toggle(item.key)}
                />
                <span className={cn(stored[item.key] && "line-through text-muted-foreground")}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Building2 className="h-4 w-4 text-primary" />
        Finanzierung vorbereiten {propertyName && `— ${propertyName}`}
      </h3>
      <p className="text-[10px] text-muted-foreground mb-3">
        Checkliste für Bank-Unterlagen. Abgehakt = erledigt.
      </p>
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-2">
        {DEFAULT_ITEMS.map((item) => (
          <li key={item.key}>
            <label className="flex items-center gap-2 cursor-pointer rounded-lg p-2 hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={!!stored[item.key]}
                onCheckedChange={() => toggle(item.key)}
              />
              <span className={cn(
                "text-xs flex-1",
                stored[item.key] && "line-through text-muted-foreground"
              )}>
                {item.label}
              </span>
              {stored[item.key] && <Check className="h-3.5 w-3.5 text-profit shrink-0" />}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
