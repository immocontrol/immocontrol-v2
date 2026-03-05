/**
 * INHALT-14: Monatsabschluss-Workflow — Strukturierter Monatsabschluss
 * Checkliste: Mieteingänge geprüft? Offene Rechnungen? NK-Vorauszahlungen korrekt?
 * Monat abschließen mit Zusammenfassung.
 */
import { memo, useState, useCallback, useMemo } from "react";
import { ClipboardCheck, CheckCircle2, Circle, ChevronDown, ChevronUp, Calendar, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  checked: boolean;
}

const DEFAULT_CHECKLIST: Omit<ChecklistItem, "checked">[] = [
  { id: "mieteingaenge", label: "Alle Mieteingänge kontrolliert", category: "Einnahmen" },
  { id: "mietrueckstaende", label: "Mietrückstände geprüft & gemahnt", category: "Einnahmen" },
  { id: "nk_vorauszahlungen", label: "NK-Vorauszahlungen eingegangen", category: "Einnahmen" },
  { id: "darlehensraten", label: "Darlehensraten korrekt abgebucht", category: "Ausgaben" },
  { id: "rechnungen", label: "Offene Rechnungen bezahlt", category: "Ausgaben" },
  { id: "hausgeld", label: "Hausgeld/WEG-Zahlungen überwiesen", category: "Ausgaben" },
  { id: "belege", label: "Alle Belege digital erfasst", category: "Dokumentation" },
  { id: "kontoabstimmung", label: "Kontoabstimmung durchgeführt", category: "Dokumentation" },
  { id: "versicherungen", label: "Versicherungsbeiträge geprüft", category: "Prüfung" },
  { id: "wartung", label: "Wartungsarbeiten überprüft", category: "Prüfung" },
  { id: "mietvertraege", label: "Auslaufende Mietverträge geprüft", category: "Prüfung" },
  { id: "steuern", label: "Steuerlich relevante Buchungen markiert", category: "Steuer" },
];

const STORAGE_KEY = "immo_monatsabschluss";

const MonatsabschlussWorkflow = memo(() => {
  const { properties, stats } = useProperties();
  const [expanded, setExpanded] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_${currentMonth}`) || "null");
      if (stored) return stored;
    } catch { /* ignore */ }
    return DEFAULT_CHECKLIST.map((item) => ({ ...item, checked: false }));
  });

  const [closedMonths, setClosedMonths] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${STORAGE_KEY}_closed`) || "[]"); }
    catch { return []; }
  });

  const progress = useMemo(() => {
    const total = checklist.length;
    const done = checklist.filter((c) => c.checked).length;
    return { total, done, percent: total > 0 ? (done / total) * 100 : 0 };
  }, [checklist]);

  const isCurrentMonthClosed = closedMonths.includes(currentMonth);

  const toggleItem = useCallback((id: string) => {
    if (isCurrentMonthClosed) return;
    setChecklist((prev) => {
      const updated = prev.map((item) => item.id === id ? { ...item, checked: !item.checked } : item);
      localStorage.setItem(`${STORAGE_KEY}_${currentMonth}`, JSON.stringify(updated));
      return updated;
    });
  }, [currentMonth, isCurrentMonthClosed]);

  const closeMonth = useCallback(() => {
    if (progress.percent < 100) {
      toast.error("Bitte alle Punkte abhaken bevor der Monat abgeschlossen wird");
      return;
    }
    const updated = [...closedMonths, currentMonth];
    setClosedMonths(updated);
    localStorage.setItem(`${STORAGE_KEY}_closed`, JSON.stringify(updated));
    toast.success(`Monat ${currentMonth} abgeschlossen`);
  }, [progress, closedMonths, currentMonth]);

  const exportSummary = useCallback(() => {
    const monthLabel = new Date(currentMonth + "-01").toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const lines = [
      `Monatsabschluss: ${monthLabel}`,
      `Portfolio: ${properties.length} Objekte`,
      ``,
      `Zusammenfassung:`,
      `Mieteinnahmen: ${formatCurrency(stats.totalRent)}`,
      `Ausgaben: ${formatCurrency(stats.totalExpenses)}`,
      `Kreditraten: ${formatCurrency(stats.totalCreditRate)}`,
      `Netto-Cashflow: ${formatCurrency(stats.totalCashflow)}`,
      ``,
      `Checkliste:`,
      ...checklist.map((c) => `${c.checked ? "[x]" : "[ ]"} ${c.label}`),
      ``,
      `Status: ${progress.done}/${progress.total} erledigt (${progress.percent.toFixed(0)}%)`,
      `Abgeschlossen: ${isCurrentMonthClosed ? "Ja" : "Nein"}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monatsabschluss-${currentMonth}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Zusammenfassung exportiert");
  }, [properties, stats, checklist, progress, isCurrentMonthClosed, currentMonth]);

  if (properties.length === 0) return null;

  const categories = [...new Set(checklist.map((c) => c.category))];

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Monatsabschluss</h3>
          <Badge variant="outline" className="text-[10px] h-5">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date(currentMonth + "-01").toLocaleDateString("de-DE", { month: "short", year: "numeric" })}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">{progress.done}/{progress.total} erledigt</span>
          <span className={`font-bold ${progress.percent === 100 ? "text-profit" : "text-primary"}`}>
            {progress.percent.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progress.percent === 100 ? "bg-profit" : "bg-primary"}`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {isCurrentMonthClosed && (
        <div className="flex items-center gap-1 text-[10px] text-profit p-1.5 rounded bg-profit/5 mb-2">
          <CheckCircle2 className="h-3 w-3" />
          Monat erfolgreich abgeschlossen
        </div>
      )}

      {/* Financial summary */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-[10px]">
        <div className="text-center p-1.5 rounded bg-background/50">
          <span className="text-muted-foreground">Einnahmen</span>
          <p className="font-bold text-profit">{formatCurrency(stats.totalRent)}</p>
        </div>
        <div className="text-center p-1.5 rounded bg-background/50">
          <span className="text-muted-foreground">Cashflow</span>
          <p className={`font-bold ${stats.totalCashflow >= 0 ? "text-profit" : "text-loss"}`}>
            {formatCurrency(stats.totalCashflow)}
          </p>
        </div>
      </div>

      {/* Checklist */}
      {expanded && (
        <div className="space-y-2 mb-3">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">{cat}</p>
              {checklist.filter((c) => c.category === cat).map((item) => (
                <button
                  key={item.id}
                  className="flex items-center gap-2 w-full text-left text-[10px] p-1 rounded hover:bg-accent/50 transition-colors"
                  onClick={() => toggleItem(item.id)}
                  disabled={isCurrentMonthClosed}
                >
                  {item.checked ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-profit shrink-0" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={item.checked ? "line-through text-muted-foreground" : ""}>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {expanded && (
        <div className="flex gap-1">
          {!isCurrentMonthClosed && (
            <Button
              size="sm"
              className="flex-1 text-[10px] h-7"
              onClick={closeMonth}
              disabled={progress.percent < 100}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Monat abschließen
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-[10px] h-7 px-2" onClick={exportSummary}>
            <Download className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
});
MonatsabschlussWorkflow.displayName = "MonatsabschlussWorkflow";

export { MonatsabschlussWorkflow };
