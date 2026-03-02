/**
 * WIDGET-1: Dashboard Widget Configuration Hook
 *
 * Allows users to customize which dashboard widgets are visible,
 * their order, and layout preferences. Persisted in localStorage.
 */

import { useState, useCallback, useMemo } from "react";

export interface WidgetConfig {
  id: string;
  label: string;
  category: "analyse" | "finanzen" | "immobilien" | "steuer" | "sonstiges";
  visible: boolean;
  order: number;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "occupancy", label: "Auslastung", category: "immobilien", visible: true, order: 0 },
  { id: "yieldHeatmap", label: "Rendite-Heatmap", category: "analyse", visible: true, order: 1 },
  { id: "portfolioType", label: "Portfolio nach Typ", category: "immobilien", visible: true, order: 2 },
  { id: "cashflowPerSqm", label: "Cashflow pro m²", category: "finanzen", visible: true, order: 3 },
  { id: "portfolioGoals", label: "Portfolio-Ziele", category: "analyse", visible: true, order: 4 },
  { id: "quickNote", label: "Schnellnotiz", category: "sonstiges", visible: true, order: 5 },
  { id: "portfolioForecast", label: "Portfolio-Prognose", category: "analyse", visible: true, order: 6 },
  { id: "renditeRanking", label: "Rendite-Ranking", category: "analyse", visible: true, order: 7 },
  { id: "wasserfall", label: "Wasserfall-Chart", category: "finanzen", visible: true, order: 8 },
  { id: "diversifikation", label: "Diversifikations-Score", category: "analyse", visible: true, order: 9 },
  { id: "tilgungsProgress", label: "Tilgungs-Fortschritt", category: "finanzen", visible: true, order: 10 },
  { id: "steuerHelfer", label: "Steuer-Helfer", category: "steuer", visible: true, order: 11 },
  { id: "annualSummary", label: "Jahresübersicht", category: "finanzen", visible: true, order: 12 },
  { id: "cashReserve", label: "Liquiditätsreserve", category: "finanzen", visible: true, order: 13 },
  { id: "mortgageStress", label: "Zinsstress-Test", category: "finanzen", visible: true, order: 14 },
  { id: "milestones", label: "Portfolio-Meilensteine", category: "sonstiges", visible: true, order: 15 },
  { id: "taxDeadline", label: "Steuer-Fristen", category: "steuer", visible: true, order: 16 },
  { id: "gegCompliance", label: "GEG-Compliance", category: "immobilien", visible: true, order: 17 },
  { id: "mietpreisbremse", label: "Mietpreisbremse", category: "immobilien", visible: true, order: 18 },
  { id: "refinancing", label: "Umschuldungsrechner", category: "finanzen", visible: true, order: 19 },
  { id: "grundsteuer", label: "Grundsteuer", category: "steuer", visible: true, order: 20 },
  { id: "hausgeld", label: "Hausgeld-Tracker", category: "finanzen", visible: true, order: 21 },
  { id: "vacancyCost", label: "Leerstandskosten", category: "finanzen", visible: true, order: 22 },
  { id: "renovationROI", label: "Renovierungs-ROI", category: "analyse", visible: true, order: 23 },
  { id: "budgetVsActual", label: "Budget vs. Ist", category: "finanzen", visible: true, order: 24 },
  { id: "rentCollection", label: "Mieteinzug", category: "finanzen", visible: true, order: 25 },
  { id: "yearOverYear", label: "Jahresvergleich", category: "analyse", visible: true, order: 26 },
  { id: "contractExpiry", label: "Vertragsablauf", category: "immobilien", visible: true, order: 27 },
  { id: "expenseCategory", label: "Ausgaben nach Kategorie", category: "finanzen", visible: true, order: 28 },
  { id: "maintenanceCost", label: "Instandhaltungskosten", category: "immobilien", visible: true, order: 29 },
  { id: "portfolioAllocation", label: "Portfolio-Verteilung", category: "analyse", visible: true, order: 30 },
  { id: "loanAmortization", label: "Tilgungsplan-Mini", category: "finanzen", visible: true, order: 31 },
  { id: "debtEquity", label: "Schulden/Eigenkapital", category: "finanzen", visible: true, order: 32 },
  { id: "netWorth", label: "Nettovermögen", category: "finanzen", visible: true, order: 33 },
  { id: "tenantLease", label: "Mietervertragswarnungen", category: "immobilien", visible: true, order: 34 },
  { id: "actionCenter", label: "Aktionszentrum", category: "sonstiges", visible: true, order: 35 },
  { id: "portfolioHistorie", label: "Portfolio-Historie", category: "analyse", visible: true, order: 36 },
];

const STORAGE_KEY = "immo-widget-config";

function loadConfig(): WidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const saved = JSON.parse(raw) as WidgetConfig[];
    /* Merge with defaults to add any new widgets */
    const savedMap = new Map(saved.map(w => [w.id, w]));
    return DEFAULT_WIDGETS.map(def => {
      const saved = savedMap.get(def.id);
      return saved ? { ...def, visible: saved.visible, order: saved.order } : def;
    }).sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function saveConfig(widgets: WidgetConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}

export function useWidgetConfig() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadConfig);

  const visibleWidgets = useMemo(() => widgets.filter(w => w.visible).sort((a, b) => a.order - b.order), [widgets]);
  const hiddenWidgets = useMemo(() => widgets.filter(w => !w.visible), [widgets]);

  const toggleWidget = useCallback((id: string) => {
    setWidgets(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
      saveConfig(updated);
      return updated;
    });
  }, []);

  const moveWidget = useCallback((id: string, direction: "up" | "down") => {
    setWidgets(prev => {
      const visible = prev.filter(w => w.visible).sort((a, b) => a.order - b.order);
      const idx = visible.findIndex(w => w.id === id);
      if (idx === -1) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= visible.length) return prev;

      const updated = [...prev];
      const aWidget = updated.find(w => w.id === visible[idx].id);
      const bWidget = updated.find(w => w.id === visible[swapIdx].id);
      if (aWidget && bWidget) {
        const tempOrder = aWidget.order;
        aWidget.order = bWidget.order;
        bWidget.order = tempOrder;
      }
      saveConfig(updated);
      return [...updated];
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    saveConfig(DEFAULT_WIDGETS);
  }, []);

  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    cats.set("analyse", "Analyse");
    cats.set("finanzen", "Finanzen");
    cats.set("immobilien", "Immobilien");
    cats.set("steuer", "Steuer");
    cats.set("sonstiges", "Sonstiges");
    return cats;
  }, []);

  return {
    widgets,
    visibleWidgets,
    hiddenWidgets,
    toggleWidget,
    moveWidget,
    resetToDefaults,
    categories,
  };
}

export { DEFAULT_WIDGETS };
