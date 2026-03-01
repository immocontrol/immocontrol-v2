import { useState, useCallback } from "react";
import { History, Trash2, ChevronDown, ChevronUp, ExternalLink, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { AnalysisInputState } from "@/hooks/useAnalysisCalculations";
import { BUNDESLAENDER_GRUNDERWERBSTEUER } from "@/hooks/useAnalysisCalculations";

export interface ExposeHistoryEntry {
  id: string;
  data: Record<string, any>;
  source: "url" | "pdf";
  sourceLabel: string;
  importedAt: string;
}

const STORAGE_KEY = "immo-expose-history";

export function loadExposeHistory(): ExposeHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveExposeHistoryEntry(entry: ExposeHistoryEntry) {
  const history = loadExposeHistory();
  // Deduplicate by title+kaufpreis combo
  const exists = history.findIndex(
    (h) => h.data.titel === entry.data.titel && h.data.kaufpreis === entry.data.kaufpreis
  );
  if (exists >= 0) history.splice(exists, 1);
  history.unshift(entry);
  // Keep max 20
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
}

interface Props {
  onImport: (updates: Partial<AnalysisInputState>) => void;
}

const ExposeHistory = ({ onImport }: Props) => {
  const [history, setHistory] = useState<ExposeHistoryEntry[]>(loadExposeHistory);
  const [expanded, setExpanded] = useState(false);

  const applyEntry = useCallback(
    (entry: ExposeHistoryEntry) => {
      const d = entry.data;
      const updates: Partial<AnalysisInputState> = {};

      if (d.kaufpreis && d.kaufpreis > 0) updates.kaufpreis = d.kaufpreis;
      if (d.monatlicheMiete && d.monatlicheMiete > 0) updates.monatlicheMiete = d.monatlicheMiete;
      if (d.quadratmeter && d.quadratmeter > 0) updates.quadratmeter = d.quadratmeter;
      if (d.bewirtschaftungskosten && d.bewirtschaftungskosten > 0)
        updates.bewirtschaftungskosten = d.bewirtschaftungskosten;
      if (d.maklerProvision && d.maklerProvision > 0) updates.maklerProvision = d.maklerProvision;
      if (d.bundesland && BUNDESLAENDER_GRUNDERWERBSTEUER[d.bundesland]) {
        updates.bundesland = d.bundesland;
      }

      onImport(updates);
      toast.success(`"${d.titel || "Exposé"}" geladen`);
    },
    [onImport]
  );

  const removeEntry = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    toast.success("Eintrag entfernt");
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
    toast.success("Verlauf gelöscht");
  }, []);

  if (history.length === 0) return null;

  const displayed = expanded ? history : history.slice(0, 3);

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Exposé-Verlauf
          <span className="text-xs font-normal text-muted-foreground">({history.length})</span>
        </h2>
        <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground" onClick={clearAll}>
          <Trash2 className="h-3 w-3 mr-1" /> Alle löschen
        </Button>
      </div>

      <div className="space-y-1.5">
        {displayed.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 group hover:bg-secondary transition-colors"
          >
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">
                {entry.data.titel || "Unbekanntes Objekt"}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                {entry.data.kaufpreis && (
                  <span>{Number(entry.data.kaufpreis).toLocaleString("de-DE")} €</span>
                )}
                {entry.data.quadratmeter && <span>· {entry.data.quadratmeter} m²</span>}
                <span>· {entry.source === "url" ? "Link" : "PDF"}</span>
              </div>
            </div>
            {/* UI-UPDATE-34: Keep expose history actions visible on mobile (no hover) */}
            <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mobile-action-row">
              {/* UI-UPDATE-35: Tooltip on apply entry action */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => applyEntry(entry)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Übernehmen</TooltipContent>
              </Tooltip>
              {/* UI-UPDATE-36: Tooltip on remove entry action */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeEntry(entry.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Entfernen</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>

      {history.length > 3 && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Weniger anzeigen
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> {history.length - 3} weitere anzeigen
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default ExposeHistory;
