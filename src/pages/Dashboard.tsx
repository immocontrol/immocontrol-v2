import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDashboardExports } from "@/hooks/useDashboardExports";
import { Building2, TrendingUp, Wallet, Landmark, PiggyBank, Search, ArrowUpDown, Download, Trophy, AlertTriangle, Ruler, Banknote, X, RefreshCw, Share2, Clock, Printer, Percent, Users, BarChart3, GripVertical } from "lucide-react";
import { useDragReorder } from "@/hooks/useDragReorder";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import OverduePaymentBanner from "@/components/OverduePaymentBanner";
import { escapeHtml } from "@/lib/sanitize";
import { AnomalyDetection } from "@/components/AnomalyDetection";
import { RentIncreaseTimeline } from "@/components/RentIncreaseTimeline";
import { LoanFixedInterestCountdown } from "@/components/LoanFixedInterestCountdown";
import { FavoritesBar } from "@/components/FavoritesBar";
import { DashboardPresets } from "@/components/DashboardPresets";
import StatCard from "@/components/StatCard";
import PortfolioHealthScore from "@/components/PortfolioHealthScore";
import PropertyCard from "@/components/PropertyCard";
import AddPropertyDialog from "@/components/AddPropertyDialog";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { useProperties } from "@/context/PropertyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import { DashboardWidgetGrid, DEFAULT_WIDGET_ORDER, WIDGET_LABELS, type WidgetId } from "@/components/dashboard/DashboardWidgetGrid";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency, formatCompactDE, pluralDE, safeDivide, truncate } from "@/lib/formatters";
import { useDebounce } from "@/hooks/useDebounce";

type FilterType = "alle" | "egbr" | "privat";
type SortType = "name" | "value" | "rent" | "cashflow" | "rendite";
type TypeFilter = "alle" | "MFH" | "ETW" | "EFH" | "Gewerbe";

const Dashboard = ({ mode = "portfolio" }: { mode?: "portfolio" | "personal" }) => {
  const { properties, loading, stats } = useProperties();
  const { user } = useAuth();
  const qc = useQueryClient();

  /* IMP-41-20: Dynamic document title with property count for browser tab clarity */
  useEffect(() => {
    const count = properties.length;
    document.title = mode === "personal"
      ? `Dashboard (${count}) – ImmoControl`
      : `Portfolio (${count}) – ImmoControl`;
  }, [mode, properties.length]);

  const { data: allTenants = [] } = useQuery({
    queryKey: ["all_tenants_dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("property_id, is_active, monthly_rent");
      return (data || []) as { property_id: string; is_active: boolean; monthly_rent: number }[];
    },
    enabled: !!user,
  });
  const [filter, setFilter] = useState<FilterType>("alle");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("alle");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const [sort, setSort] = useState<SortType>("name");
  const [refreshing, setRefreshing] = useState(false);
  /* STR-9: Track last refresh timestamp for user transparency */
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /* Dashboard: No collapsible sections — everything visible at once */
  const [isWidgetDragOverview, setIsWidgetDragOverview] = useState(false);

  /* Fix 3: Widget order/labels extracted to DashboardWidgetGrid component */
  const WIDGET_STORAGE_KEY = "immo-dashboard-widget-order";
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(() => {
    try {
      const stored = localStorage.getItem(WIDGET_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WidgetId[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(w => DEFAULT_WIDGET_ORDER.includes(w));
          const missing = DEFAULT_WIDGET_ORDER.filter(w => !valid.includes(w));
          if (missing.length > 0) return [...valid, ...missing];
          return valid.length > 0 ? valid : DEFAULT_WIDGET_ORDER;
        }
      }
    } catch { /* ignore */ }
    return DEFAULT_WIDGET_ORDER;
  });

  const widgetDrag = useDragReorder(
    widgetOrder,
    (next) => { setWidgetOrder(next); setIsWidgetDragOverview(false); },
    WIDGET_STORAGE_KEY,
  );

  useEffect(() => {
    setIsWidgetDragOverview(widgetDrag.isDragging);
  }, [widgetDrag.isDragging]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>("[data-add-property]")?.click();
      }
      // Improvement 11: Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* Fix 3b: CSV/PDF export logic extracted to useDashboardExports hook */
  const { exportCSV, exportPDF } = useDashboardExports(properties, stats);

  // Feature 1 + 2 + filter
  const filteredProperties = useMemo(() => {
    const result = properties.filter((p) => {
      if (filter !== "alle" && p.ownership !== filter) return false;
      if (typeFilter !== "alle" && p.type !== typeFilter) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.address || "").toLowerCase().includes(q) || p.type.toLowerCase().includes(q);
      }
      return true;
    });

    result.sort((a, b) => {
      switch (sort) {
        case "value": return b.currentValue - a.currentValue;
        case "rent": return b.monthlyRent - a.monthlyRent;
        case "cashflow": return b.monthlyCashflow - a.monthlyCashflow;
        case "rendite": {
          const rA = a.purchasePrice > 0 ? (a.monthlyRent * 12) / a.purchasePrice : 0;
          const rB = b.purchasePrice > 0 ? (b.monthlyRent * 12) / b.purchasePrice : 0;
          return rB - rA;
        }
        default: return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [properties, filter, typeFilter, debouncedSearch, sort]);

  // Feature 10: Best/Worst performer
  const bestPerformer = useMemo(() => {
    if (properties.length === 0) return null;
    return properties.reduce((best, p) => p.monthlyCashflow > best.monthlyCashflow ? p : best, properties[0]);
  }, [properties]);

  const worstPerformer = useMemo(() => {
    if (properties.length === 0) return null;
    return properties.reduce((worst, p) => p.monthlyCashflow < worst.monthlyCashflow ? p : worst, properties[0]);
  }, [properties]);

  const filterCounts = useMemo(() => ({
    egbr: properties.filter(p => p.ownership === "egbr").length,
    privat: properties.filter(p => p.ownership === "privat").length,
  }), [properties]);

  /* STR-9: Show last refreshed timestamp after data refresh */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: queryKeys.properties.all });
    setTimeout(() => {
      setRefreshing(false);
      setLastRefreshed(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    }, 600);
  }, [qc]);

  /* FUNC-1: Portfolio summary metrics */
  const portfolioMetrics = useMemo(() => {
    /* OPT-8: safeDivide for stable calculations */
    const totalRentPerSqm = safeDivide(stats.totalRent, stats.totalSqm, 0);
    const avgValuePerUnit = safeDivide(stats.totalValue, stats.totalUnits, 0);
    const debtToEquityRatio = safeDivide(stats.totalDebt, stats.equity, 0);
    const annualCashflow = stats.totalCashflow * 12;
    const cashOnCashReturn = safeDivide(annualCashflow * 100, stats.equity, 0);
    return { totalRentPerSqm, avgValuePerUnit, debtToEquityRatio, annualCashflow, cashOnCashReturn };
  }, [stats]);

  /* FUNC-2: Property count by type */
  const propertyTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    properties.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
    return counts;
  }, [properties]);

  /* FUNC-3: Vacancy detection - properties with no active tenants */
  const vacantProperties = useMemo(() => {
    return properties.filter(p => {
      const propTenants = allTenants.filter(t => t.property_id === p.id && t.is_active);
      return propTenants.length === 0;
    });
  }, [properties, allTenants]);

  /* OPT-11: Memoized total rent from tenants for accuracy */
  const totalTenantRent = useMemo(() => {
    return allTenants.filter(t => t.is_active).reduce((s, t) => s + (t.monthly_rent || 0), 0);
  }, [allTenants]);

  /* IMP20-3: Fix unsafe Record<string, unknown> cast — use typed Property.purchaseDate directly */
  const avgHoldingPeriodMonths = useMemo(() => {
    if (properties.length === 0) return 0;
    const totalMonths = properties.reduce((s, p) => {
      if (!p.purchaseDate) return s;
      const months = Math.floor((Date.now() - new Date(p.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
      return s + months;
    }, 0);
    /* IMP-34-20: NaN guard — ensure finite result even with invalid dates */
    const raw = totalMonths / properties.length;
    return Number.isFinite(raw) ? Math.round(raw) : 0;
  }, [properties]);

  /* FUNC-5: Highest and lowest yield properties */
  const yieldExtremes = useMemo(() => {
    if (properties.length === 0) return { highest: null, lowest: null };
    const withYield = properties.map(p => ({
      ...p,
      yieldPct: p.purchasePrice > 0 ? (p.monthlyRent * 12 / p.purchasePrice * 100) : 0,
    }));
    const sorted = [...withYield].sort((a, b) => b.yieldPct - a.yieldPct);
    return { highest: sorted[0], lowest: sorted[sorted.length - 1] };
  }, [properties]);

  /* BUG-FIX: Move greeting useMemo BEFORE early returns to satisfy React Rules of Hooks.
     Hooks must always be called in the same order — conditional returns must come after all hooks. */
  const greeting = useMemo(() => {
    const userName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
    const h = new Date().getHours();
    const name = userName ? `, ${userName}` : "";
    if (h < 12) return `Guten Morgen${name}`;
    if (h < 18) return `Guten Tag${name}`;
    return `Guten Abend${name}`;
  }, [user]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "alle", label: "Alle" },
    { key: "egbr", label: "eGbR" },
    { key: "privat", label: "Privat" },
  ];

  // Feature 6: Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            {/* UI-4: skeleton-wave for loading */}
            <div className="h-8 w-48 skeleton-wave rounded-lg" />
            <div className="h-4 w-32 skeleton-wave rounded-lg mt-2" />
          </div>
          <div className="h-9 w-36 skeleton-wave rounded-lg" />
        </div>
        {/* UI-2: card-stagger-enter for stagger animation */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 card-stagger-enter">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="gradient-card rounded-xl border border-border p-4 space-y-3">
              <div className="h-3 w-20 skeleton-wave rounded" />
              <div className="h-7 w-28 skeleton-wave rounded" />
              <div className="h-3 w-24 skeleton-wave rounded" />
            </div>
          ))}
        </div>
        <div className="h-20 skeleton-wave rounded-xl" />
        <div className="grid md:grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-56 skeleton-wave rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Feature 3: Empty state
  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
          <AddPropertyDialog />
        </div>

        {/* Preview KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Gesamtwert", icon: <Building2 className="h-4 w-4" /> },
            { label: "Eigenkapital", icon: <PiggyBank className="h-4 w-4" /> },
            { label: "Mieteinnahmen/M", icon: <Wallet className="h-4 w-4" /> },
            { label: "Cashflow/M", icon: <TrendingUp className="h-4 w-4" /> },
          ].map((card) => (
            <div key={card.label} className="gradient-card rounded-xl border border-border p-4 opacity-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
                <span className="text-muted-foreground">{card.icon}</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-muted-foreground">–</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          {/* UI-10: empty-state-float for floating animation */}
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 empty-state-float">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Noch keine Objekte</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Füge dein erstes Investmentobjekt hinzu, um dein Portfolio zu tracken – Renditen, Cashflow und Wertentwicklung auf einen Blick.
          </p>
          <AddPropertyDialog />
        </div>
      </div>
    );
  }

  /* IMP20-2: Use pre-computed stats from PropertyContext — eliminates 3 redundant reduce() calls */
  const totalSqm = stats.totalSqm;
  const avgPricePerSqm = totalSqm > 0 ? stats.totalValue / totalSqm : 0;
  const totalMonthlyExpenses = stats.totalExpenses;
  const totalMonthlyCreditRate = stats.totalCreditRate;
  const totalCosts = totalMonthlyExpenses + totalMonthlyCreditRate;

  /* STR-2: Reuse memoized avgHoldingPeriodMonths instead of recalculating */
  const avgHoldingYears = Math.floor(avgHoldingPeriodMonths / 12);
  const avgHoldingRemMonths = Math.floor(avgHoldingPeriodMonths % 12);

  // Feature: Top 3 by cashflow
  const top3Cashflow = [...properties].sort((a, b) => b.monthlyCashflow - a.monthlyCashflow).slice(0, 3);

  /* UPD-48: Portfolio share with clipboard error handling */
  const sharePortfolio = () => {
    const text = `Portfolio: ${stats.propertyCount} Objekte, ${stats.totalUnits} Einheiten\nGesamtwert: ${formatCurrency(stats.totalValue)}\nEigenkapital: ${formatCurrency(stats.equity)}\nMiete: ${formatCurrency(stats.totalRent)}/M\nCashflow: ${formatCurrency(stats.totalCashflow)}/M\nBrutto-Rendite: ${stats.avgRendite.toFixed(1)}%`;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Portfolio-Zusammenfassung kopiert!"),
      () => toast.error("Kopieren fehlgeschlagen")
    );
  };

  /* UPD-49: LTV ratio with safeDivide */
  const portfolioLTV = stats.totalValue > 0 ? (stats.totalDebt / stats.totalValue * 100) : 0;
  // New Feature: Vacancy rate from tenants
  const totalUnitsFromProps = properties.reduce((s, p) => s + p.units, 0);
  const occupiedUnits = allTenants.filter(t => t.is_active).length;
  const vacancyRate = totalUnitsFromProps > 0 ? ((totalUnitsFromProps - occupiedUnits) / totalUnitsFromProps * 100) : 0;
  // New Feature: Annual income
  const annualIncome = stats.totalRent * 12;
  const annualCashflow = stats.totalCashflow * 12;

  return (
    /* IMP-3: Reduced spacing for less crowded layout */
    <div className="space-y-4" role="main" aria-label="Portfolio Dashboard">
      {mode === "personal" ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            {/* UI-11: heading-gradient for page title — single line, no truncation */}
            {/* UPD-36: Smooth page header fade-in on route change */}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight heading-gradient whitespace-nowrap page-header-enter">{greeting}</h1>
            <p className="text-sm text-muted-foreground mt-1" aria-live="polite">
              {/* OPT-10: pluralDE for correct pluralization */}
              {pluralDE(stats.propertyCount, "Objekt", "Objekte")} · {pluralDE(stats.totalUnits, "Einheit", "Einheiten")} · {totalSqm.toLocaleString("de-DE")} m²
            </p>
          </div>
          {/* Cleaned up: removed buttons that are already accessible via navigation menus
               (Rechner, Berichte, Übergabeprotokoll, Mieterhöhung, Selbstauskunft, Hockey Stick Simulator) */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Fix 9: AddPropertyDialog only on Portfolio, not Dashboard */}
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={sharePortfolio}>
              <Share2 className="h-3.5 w-3.5" />
              Teilen
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={exportPDF}>
              <Printer className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight heading-gradient whitespace-nowrap page-header-enter">Portfolio</h1>
            <p className="text-sm text-muted-foreground mt-1" aria-live="polite">
              {pluralDE(stats.propertyCount, "Objekt", "Objekte")} · {pluralDE(stats.totalUnits, "Einheit", "Einheiten")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <AddPropertyDialog />
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={sharePortfolio}>
              <Share2 className="h-3.5 w-3.5" />
              Teilen
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={exportPDF}>
              <Printer className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
        </div>
      )}

      {/* Favorites bar — quick access to favorite pages */}
      <FavoritesBar />

      {/* Dashboard Presets — save/load widget layouts (unified grid, no separate chart order) */}
      <DashboardPresets
        currentWidgetOrder={widgetOrder}
        currentChartOrder={[]}
        chartsCollapsed={false}
        widgetsCollapsed={false}
        onApply={({ widgetOrder: wo }) => {
          const typed = wo as typeof widgetOrder;
          // Reconcile: remove stale IDs and add any missing widgets (e.g. chart_* from old presets)
          const valid = typed.filter(w => DEFAULT_WIDGET_ORDER.includes(w));
          const missing = DEFAULT_WIDGET_ORDER.filter(w => !valid.includes(w));
          const finalOrder = valid.length > 0 ? [...valid, ...missing] : DEFAULT_WIDGET_ORDER;
          setWidgetOrder(finalOrder);
          try { localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(finalOrder)); } catch { /* */ }
        }}
      />

      {mode === "personal" && (
        <>
          {/* Onboarding */}
          <OnboardingBanner />

      {/* Portfolio Health Score */}
      <PortfolioHealthScore
        totalValue={stats.totalValue}
        totalDebt={stats.totalDebt}
        totalCashflow={stats.totalCashflow}
        totalRent={stats.totalRent}
        totalExpenses={totalMonthlyExpenses}
        totalCreditRate={totalMonthlyCreditRate}
        vacancyRate={vacancyRate}
        propertyCount={stats.propertyCount}
      />

      {/* IMPROVE-40: Responsive stat card grid — 2 columns on mobile, 5 on desktop for optimal readability */}
      {/* Key stats — UI-2: card-stagger-enter */}
      {/* IMP-44-10: Add aria-label to stat card grid for screen readers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 card-stagger-enter" aria-label="Portfolio-Kennzahlen">
        <StatCard
          label="Gesamtwert"
          value={formatCurrency(stats.totalValue)}
          subValue={`${stats.appreciation >= 0 ? "+" : ""}${stats.appreciation.toFixed(1)}% Wertzuwachs`}
          trend={stats.appreciation >= 0 ? "up" : "down"}
          tooltip={`Kaufpreis gesamt: ${formatCurrency(stats.totalPurchase)} → Aktueller Wert: ${formatCurrency(stats.totalValue)}`}
          icon={<Building2 className="h-4 w-4" />}
          delay={0}
        />
        <StatCard
          label="Eigenkapital"
          value={formatCurrency(stats.equity)}
          icon={<PiggyBank className="h-4 w-4" />}
          delay={50}
        />
        <StatCard
          label="Mieteinnahmen/M"
          value={formatCurrency(stats.totalRent)}
          subValue={`${stats.avgRendite.toFixed(1)}% Brutto-Rendite`}
          trend="up"
          icon={<Wallet className="h-4 w-4" />}
          delay={100}
        />
        <StatCard
          label="Cashflow/M"
          value={formatCurrency(stats.totalCashflow)}
          subValue={`${formatCurrency(stats.totalCashflow * 12)}/Jahr`}
          trend={stats.totalCashflow >= 0 ? "up" : "down"}
          icon={<TrendingUp className="h-4 w-4" />}
          delay={150}
        />
        <StatCard
          label="Ø Wert/m²"
          value={formatCurrency(avgPricePerSqm)}
          subValue={`${totalSqm.toLocaleString("de-DE")} m² gesamt`}
          icon={<Ruler className="h-4 w-4" />}
          delay={200}
        />
      </div>

      {/* Improvement 15: Quick KPI row — UI-2/UI-15/UI-42: card-stagger-enter, card-accent-shadow, currency-display */}
      {/* IMP-44-11: Add aria-label to quick KPI row for screen readers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 card-stagger-enter" aria-label="Schnell-KPIs">
        <div className="gradient-card rounded-xl border border-border p-3 text-center card-accent-shadow">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">LTV</p>
          <p className={`text-lg font-bold ${portfolioLTV <= 60 ? "text-profit" : portfolioLTV <= 80 ? "text-gold" : "text-loss"}`}>{portfolioLTV.toFixed(1)}%</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 text-center card-accent-shadow">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Leerstand</p>
          <p className={`text-lg font-bold ${vacancyRate === 0 ? "text-profit" : vacancyRate <= 10 ? "text-gold" : "text-loss"}`}>{vacancyRate.toFixed(0)}%</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 text-center card-accent-shadow">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Jahresmiete</p>
          <p className="text-lg font-bold currency-display">{formatCurrency(annualIncome)}</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 text-center card-accent-shadow">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Jahres-Cashflow</p>
          <p className={`text-lg font-bold currency-display ${annualCashflow >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(annualCashflow)}</p>
        </div>
      </div>

      {/* FUNC-1/2/3/5 + OPT-11: render memoized portfolio insights */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Insights</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground pill-badge">
              {formatCompactDE(stats.totalValue)} Wert
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-lg bg-secondary/40 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Miete/m²</p>
              <p className="text-sm font-bold currency-display">{formatCurrency(portfolioMetrics.totalRentPerSqm)}</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Wert/Einheit</p>
              <p className="text-sm font-bold currency-display">{formatCurrency(portfolioMetrics.avgValuePerUnit)}</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Debt/Equity</p>
              <p className="text-sm font-bold">{portfolioMetrics.debtToEquityRatio.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CoC-Rendite</p>
              <p className="text-sm font-bold">{portfolioMetrics.cashOnCashReturn.toFixed(1)}%</p>
            </div>
          </div>

          {/* OPT-11: Tenant-rent vs. property-rent */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Aktive Mieten (Mieter)</span>
              <span className="currency-display">{formatCurrency(totalTenantRent)}</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-primary rounded-full progress-smooth"
                style={{ width: `${Math.min(100, safeDivide(totalTenantRent * 100, stats.totalRent, 0))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Objekttypen</h3>
            {vacantProperties.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-loss/10 text-loss font-semibold pill-badge">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-loss status-dot-pulse" />
                  {pluralDE(vacantProperties.length, "Leerstand", "Leerstände")}
                </span>
              </span>
            )}
          </div>

          <div className="mt-3 space-y-1.5">
            {Object.entries(propertyTypeCounts).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between rounded-lg px-2 py-1 table-row-hover">
                <span className="text-xs font-medium">{truncate(type, 18)}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground pill-badge">
                  {formatCompactDE(count)}
                </span>
              </div>
            ))}
          </div>

          {yieldExtremes.highest && (
            <div className="mt-3 text-[11px] text-muted-foreground">
              <p>
                Top Rendite: <span className="font-medium text-foreground">{truncate(yieldExtremes.highest.name, 22)}</span> · {yieldExtremes.highest.yieldPct.toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Debt overview + Improvement 3: Monthly cost summary */}
      {/* UI-14: progress-smooth for animated progress bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Restschuld gesamt</span>
            </div>
            <span className="text-lg font-bold">{formatCurrency(stats.totalDebt)}</span>
          </div>
          <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
            {/* UI-14: progress-smooth */}
            <div
              className="h-full bg-primary rounded-full progress-smooth"
              style={{ width: `${stats.totalValue > 0 ? ((stats.totalValue - stats.totalDebt) / stats.totalValue) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>Tilgungsfortschritt</span>
            <span>{stats.totalValue > 0 ? (((stats.totalValue - stats.totalDebt) / stats.totalValue) * 100).toFixed(0) : 0}%</span>
          </div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Kosten / Monat</span>
            </div>
            <span className="text-lg font-bold text-loss">{formatCurrency(totalCosts)}</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kreditraten</span>
              <span className="font-medium">{formatCurrency(totalMonthlyCreditRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bewirtschaftung</span>
              <span className="font-medium">{formatCurrency(totalMonthlyExpenses)}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-border/50">
              <span className="text-muted-foreground">Kostenquote</span>
              <span className={`font-medium ${stats.totalRent > 0 && totalCosts / stats.totalRent > 0.8 ? "text-loss" : "text-profit"}`}>
                {stats.totalRent > 0 ? ((totalCosts / stats.totalRent) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* IMP-4: Consolidated best/worst performer — removed redundant advanced metrics row, holding period, and top 3 */}
      {properties.length >= 2 && bestPerformer && worstPerformer && bestPerformer.id !== worstPerformer.id && (
        <div className="grid grid-cols-2 gap-2">
          <div className="gradient-card rounded-xl border border-border p-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Top Cashflow</p>
              <p className="text-xs font-semibold truncate">{bestPerformer.name}</p>
              <p className="text-[10px] text-profit font-medium">{formatCurrency(bestPerformer.monthlyCashflow)}/M</p>
            </div>
          </div>
          <div className="gradient-card rounded-xl border border-border p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-loss shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Schwächster</p>
              <p className="text-xs font-semibold truncate">{worstPerformer.name}</p>
              <p className={`text-[10px] font-medium ${worstPerformer.monthlyCashflow >= 0 ? "text-profit" : "text-loss"}`}>
                {formatCurrency(worstPerformer.monthlyCashflow)}/M
              </p>
            </div>
          </div>
        </div>
      )}

        </>
      )}

      {/* #14: Anomaly Detection — automatic portfolio warnings */}
      {mode === "personal" && <AnomalyDetection />}

      {/* Overdue Payment Banner */}
      <OverduePaymentBanner />

      {/* #15 + #16: Rent Increase Timeline + Loan Fixed Interest Countdown */}
      {mode === "personal" && (
        <div className="grid md:grid-cols-2 gap-3">
          <WidgetErrorBoundary name="Mieterhöhungs-Timeline">
            <RentIncreaseTimeline />
          </WidgetErrorBoundary>
          <WidgetErrorBoundary name="Zinsbindungs-Countdown">
            <LoanFixedInterestCountdown />
          </WidgetErrorBoundary>
        </div>
      )}

      {mode === "portfolio" && (
        <>
          {/* Search + Sort + Filter - MOVED UP for sticky properties */}
      <div className="flex flex-col gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Objekt suchen… (⌘K)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Suche leeren"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
            <SelectTrigger className="h-9 w-[150px] text-sm">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="value">Wert</SelectItem>
              <SelectItem value="rent">Miete</SelectItem>
              <SelectItem value="cashflow">Cashflow</SelectItem>
              <SelectItem value="rendite">Rendite</SelectItem>
            </SelectContent>
          </Select>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === f.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.label}
              {f.key !== "alle" && (
                <span className="ml-1 text-muted-foreground">
                  ({filterCounts[f.key as "egbr" | "privat"]})
                </span>
              )}
            </button>
          ))}
          {/* Property type quick-filter chips */}
          <div className="flex items-center gap-1 sm:ml-2 sm:border-l sm:border-border sm:pl-2 overflow-x-auto scrollbar-hide">
            {(["alle", "MFH", "ETW", "EFH", "Gewerbe"] as TypeFilter[]).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-[10px] px-2 py-1 rounded font-medium transition-colors shrink-0 ${
                  typeFilter === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t === "alle" ? "Typ: Alle" : t}
              </button>
            ))}
          </div>
          {/* UI-UPDATE-37: Tooltip on refresh action */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleRefresh}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {lastRefreshed ? `Zuletzt aktualisiert: ${lastRefreshed}` : "Daten aktualisieren"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Properties header with count */}
      {filteredProperties.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {filteredProperties.length === properties.length
              ? `${properties.length} Objekte`
              : `${filteredProperties.length} von ${properties.length} Objekten`
            }
          </h2>
          {(search || filter !== "alle" || typeFilter !== "alle") && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setSearch(""); setFilter("alle"); setTypeFilter("alle"); }}>
              Filter zurücksetzen
            </Button>
          )}
        </div>
      )}

      {/* IMP-5: Properties — removed sticky to reduce visual clutter */}
      <div>
        {filteredProperties.length === 0 ? (
          <div className="text-center py-8 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">Keine Ergebnisse</p>
            <p className="text-xs text-muted-foreground">
              {search ? `Keine Objekte gefunden für „${search}"` : "Keine Objekte in dieser Kategorie"}
            </p>
            {/* STR-10: Better empty search state with search tips */}
            {search && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Tipp: Suche nach Name, Adresse oder Objekttyp
              </p>
            )}
            <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={() => { setSearch(""); setFilter("alle"); setTypeFilter("alle"); }}>
              {search ? "Suche zurücksetzen" : "Filter zurücksetzen"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 list-stagger">
            {filteredProperties.map((property, i) => (
              <PropertyCard
                key={property.id}
                {...property}
                monthlyExpenses={property.monthlyExpenses}
                monthlyCreditRate={property.monthlyCreditRate}
                ownership={property.ownership}
                delay={i * 60}
              />
            ))}
          </div>
        )}
      </div>

        </>
      )}

      {/* Fix 3: Extracted to DashboardWidgetGrid component */}
      {mode === "personal" && (
        <DashboardWidgetGrid
          widgetOrder={widgetOrder}
          widgetDrag={widgetDrag}
          isWidgetDragOverview={isWidgetDragOverview}
          stats={{ ...stats, totalExpenses: totalMonthlyExpenses, totalCreditRate: totalMonthlyCreditRate, propertyCount: stats.propertyCount }}
          vacancyRate={vacancyRate}
          properties={properties}
          allTenants={allTenants}
        />
      )}
    </div>
  );
};

export default Dashboard;
