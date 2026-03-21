/**
 * Ein- und Auszugs-Checklisten für Mieterwechsel.
 */
import { useState, useCallback, useEffect } from "react";
import { Check, LogIn, LogOut } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const MOVE_IN_ITEMS = [
  { key: "vertrag_unterzeichnet", label: "Mietvertrag unterzeichnet" },
  { key: "kaution_eingegangen", label: "Kaution eingegangen" },
  { key: "uebergabeprotokoll", label: "Übergabeprotokoll erstellt" },
  { key: "schluessel_uebergeben", label: "Schlüssel übergeben" },
  { key: "ablesung_vor", label: "Zählerstand bei Einzug erfasst" },
  { key: "einweisung", label: "Einweisung (Müll, Heizung etc.)" },
  { key: "kontaktdaten", label: "Kontaktdaten ausgetauscht" },
];

const MOVE_OUT_ITEMS = [
  { key: "kuendigung_bestaetigt", label: "Kündigung bestätigt" },
  { key: "rueckzugstermin", label: "Rückzugsdatum vereinbart" },
  { key: "ablesung_nach", label: "Zählerstand bei Auszug erfasst" },
  { key: "schluessel_rueckgabe", label: "Schlüssel zurückgenommen" },
  { key: "uebergabeprotokoll_auszug", label: "Übergabeprotokoll (Zustand)" },
  { key: "kaution_pruefung", label: "Kaution prüfen (Schäden, NK)" },
  { key: "kaution_rueckzahlung", label: "Kaution zurückzahlen" },
  { key: "post_weiterleitung", label: "Post-Weiterleitung informiert" },
];

const STORAGE_KEY = "immo_move_checklist_";

interface MoveInOutChecklistProps {
  type: "einzug" | "auszug";
  tenantOrUnitId: string;
  label?: string;
}

export function MoveInOutChecklist({ type, tenantOrUnitId, label }: MoveInOutChecklistProps) {
  const items = type === "einzug" ? MOVE_IN_ITEMS : MOVE_OUT_ITEMS;
  const key = `${STORAGE_KEY}${type}_${tenantOrUnitId}`;

  const [stored, setStored] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const local = localStorage.getItem(key);
      setStored(local ? (JSON.parse(local) as Record<string, boolean>) : {});
    } catch {
      setStored({});
    }
  }, [key]);

  const toggle = useCallback((itemKey: string) => {
    setStored((prev) => {
      const next = { ...prev, [itemKey]: !prev[itemKey] };
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  const done = Object.values(stored).filter(Boolean).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="surface-section p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium mb-2">
        {type === "einzug" ? <LogIn className="h-4 w-4 text-primary" /> : <LogOut className="h-4 w-4 text-loss" />}
        {type === "einzug" ? "Einzugs-Checkliste" : "Auszugs-Checkliste"}
        {label && <span className="text-muted-foreground font-normal">— {label}</span>}
      </h3>
      <p className="text-[10px] text-muted-foreground mb-3">
        {done}/{total} erledigt ({pct}%)
      </p>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <label className="flex items-center gap-2 cursor-pointer rounded p-1.5 hover:bg-secondary/50 transition-colors text-xs">
              <Checkbox
                checked={!!stored[item.key]}
                onCheckedChange={() => toggle(item.key)}
              />
              <span className={cn(stored[item.key] && "line-through text-muted-foreground")}>
                {item.label}
              </span>
              {stored[item.key] && <Check className="h-3 w-3 text-profit shrink-0" />}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
