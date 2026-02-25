import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Building2, TrendingUp, Wallet, Landmark, PiggyBank, Search, ArrowUpDown, Download, Trophy, AlertTriangle, Ruler, Banknote, X, RefreshCw, Share2, Clock, Printer, Percent, Users, BarChart3 } from "lucide-react";
import PortfolioGoals from "@/components/PortfolioGoals";
import QuickNoteWidget from "@/components/QuickNoteWidget";
import OccupancyTracker from "@/components/OccupancyTracker";
import DebtEquityWidget from "@/components/DebtEquityWidget";
import YieldHeatmap from "@/components/YieldHeatmap";
import PortfolioTypeChart from "@/components/PortfolioTypeChart";
import TenantLeaseAlerts from "@/components/TenantLeaseAlerts";
import OverduePaymentBanner from "@/components/OverduePaymentBanner";
import NetWorthTracker from "@/components/NetWorthTracker";
import CashflowPerSqmWidget from "@/components/CashflowPerSqmWidget";
import { escapeHtml } from "@/lib/sanitize";
import DashboardActionCenter from "@/components/DashboardActionCenter";
import StatCard from "@/components/StatCard";
import PortfolioHealthScore from "@/components/PortfolioHealthScore";
import { QuickCalculator } from "@/components/QuickCalculator";
import { PropertyComparison } from "@/components/PropertyComparison";
import { HandoverProtocol } from "@/components/HandoverProtocol";
import { RentIncreaseLetter } from "@/components/RentIncreaseLetter";
import PropertyCard from "@/components/PropertyCard";
import { lazy, Suspense } from "react";
import AddPropertyDialog from "@/components/AddPropertyDialog";
import { FinanceExportDialog } from "@/components/FinanceExport";
import { SelbstauskunftGenerator } from "@/components/SelbstauskunftGenerator";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { useProperties } from "@/context/PropertyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/integrations/supabase/client";

const PortfolioChart = lazy(() => import("@/components/PortfolioChart"));
const CashflowChart = lazy(() => import("@/components/CashflowChart"));
const MonthlyOverviewChart = lazy(() => import("@/components/MonthlyOverviewChart"));
const PropertyMap = lazy(() => import("@/components/PropertyMap"));
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { useDebounce } from "@/hooks/useDebounce";

type FilterType = "alle" | "egbr" | "privat";
type SortType = "name" | "value" | "rent" | "cashflow" | "rendite";

const Dashboard = () => {
  const { properties, loading, stats } = useProperties();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Document title
  useEffect(() => { document.title = "Portfolio – ImmoControl"; }, []);

  const { data: allTenants = [] } = useQuery({
    queryKey: ["all_tenants_dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("property_id, is_active, monthly_rent");
      return (data || []) as { property_id: string; is_active: boolean; monthly_rent: number }[];
    },
    enabled: !!user,
  });
  const [filter, setFilter] = useState<FilterType>("alle");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const [sort, setSort] = useState<SortType>("name");
  const [refreshing, setRefreshing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Feature 4: CSV Export
  const exportCSV = useCallback(() => {
    if (properties.length === 0) return;
    const headers = ["Name", "Adresse", "Typ", "Einheiten", "Kaufpreis", "Aktueller Wert", "Miete/M", "Kosten/M", "Kreditrate/M", "Cashflow/M", "Restschuld", "Zinssatz", "m²", "Baujahr", "Besitz"];
    const rows = properties.map((p) => [
      escapeHtml(p.name), escapeHtml(p.address || ""), p.type, p.units, p.purchasePrice, p.currentValue,
      p.monthlyRent, p.monthlyExpenses, p.monthlyCreditRate, p.monthlyCashflow,
      p.remainingDebt, p.interestRate, p.sqm, p.yearBuilt, escapeHtml(p.ownership),
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportiert!");
  }, [properties]);

  // PDF Export
  const exportPDF = useCallback(() => {
    if (properties.length === 0) return;
    const pdfStats = stats;
    const html = `
<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>ImmoControl Portfoliobericht</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto}
  h1{font-size:24px;border-bottom:2px solid #2a9d6e;padding-bottom:8px}
  h2{font-size:16px;margin-top:28px;color:#555}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
  th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #eee}
  th{background:#f5f5f5;font-weight:600}
  .positive{color:#2a9d6e} .negative{color:#d94040}
  .summary{display:flex;gap:20px;flex-wrap:wrap;margin-top:16px}
  .stat{background:#f9f9f9;padding:14px 18px;border-radius:8px;flex:1;min-width:150px}
  .stat-label{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.5px}
  .stat-value{font-size:20px;font-weight:700;margin-top:4px}
  .footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center}
</style></head><body>
<h1>📊 ImmoControl Portfoliobericht</h1>
<p style="color:#888;font-size:13px">Erstellt am ${new Date().toLocaleDateString("de-DE")} · ${pdfStats.propertyCount} Objekte · ${pdfStats.totalUnits} Einheiten</p>

<div class="summary">
  <div class="stat"><div class="stat-label">Gesamtwert</div><div class="stat-value">${formatCurrency(pdfStats.totalValue)}</div></div>
  <div class="stat"><div class="stat-label">Eigenkapital</div><div class="stat-value">${formatCurrency(pdfStats.equity)}</div></div>
  <div class="stat"><div class="stat-label">Cashflow / Monat</div><div class="stat-value ${pdfStats.totalCashflow >= 0 ? 'positive' : 'negative'}">${formatCurrency(pdfStats.totalCashflow)}</div></div>
  <div class="stat"><div class="stat-label">Brutto-Rendite</div><div class="stat-value">${pdfStats.avgRendite.toFixed(1)}%</div></div>
</div>

<h2>Objektübersicht</h2>
<table>
<tr><th>Objekt</th><th>Adresse</th><th>Typ</th><th>Wert</th><th>Miete/M</th><th>Cashflow/M</th><th>Restschuld</th></tr>
${properties.map(p => `<tr>
  <td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.address || "")}</td><td>${escapeHtml(p.type)}</td>
  <td>${formatCurrency(p.currentValue)}</td><td>${formatCurrency(p.monthlyRent)}</td>
  <td class="${p.monthlyCashflow >= 0 ? 'positive' : 'negative'}">${formatCurrency(p.monthlyCashflow)}</td>
  <td>${formatCurrency(p.remainingDebt)}</td>
</tr>`).join("")}
</table>

<div class="footer">ImmoControl · Portfoliobericht · Vertraulich</div>
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
    toast.success("PDF-Bericht geöffnet");
  }, [properties, stats]);

  // Feature 1 + 2 + filter
  const filteredProperties = useMemo(() => {
    let result = properties.filter((p) => {
      if (filter !== "alle" && p.ownership !== filter) return false;
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
  }, [properties, filter, debouncedSearch, sort]);

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: queryKeys.properties.all });
    setTimeout(() => setRefreshing(false), 600);
  }, [qc]);

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
            <div className="h-8 w-48 shimmer rounded-lg" />
            <div className="h-4 w-32 shimmer rounded-lg mt-2" />
          </div>
          <div className="h-9 w-36 shimmer rounded-lg" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="gradient-card rounded-xl border border-border p-4 space-y-3">
              <div className="h-3 w-20 shimmer rounded" />
              <div className="h-7 w-28 shimmer rounded" />
              <div className="h-3 w-24 shimmer rounded" />
            </div>
          ))}
        </div>
        <div className="h-20 shimmer rounded-xl" />
        <div className="grid md:grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-56 shimmer rounded-xl" />
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
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
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

  // Improvement 10: Greeting with user name
  const userName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const greeting = (() => {
    const h = new Date().getHours();
    const name = userName ? `, ${userName}` : "";
    if (h < 12) return `Guten Morgen${name}`;
    if (h < 18) return `Guten Tag${name}`;
    return `Guten Abend${name}`;
  })();

  const totalSqm = properties.reduce((s, p) => s + (p.sqm || 0), 0);
  const avgPricePerSqm = totalSqm > 0 ? stats.totalValue / totalSqm : 0;
  const totalMonthlyExpenses = properties.reduce((s, p) => s + (p.monthlyExpenses || 0), 0);
  const totalMonthlyCreditRate = properties.reduce((s, p) => s + (p.monthlyCreditRate || 0), 0);
  const totalCosts = totalMonthlyExpenses + totalMonthlyCreditRate;

  // Feature: Average holding period
  const avgHoldingMonths = properties.length > 0
    ? properties.reduce((s, p) => {
        const months = (Date.now() - new Date(p.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        return s + months;
      }, 0) / properties.length
    : 0;
  const avgHoldingYears = Math.floor(avgHoldingMonths / 12);
  const avgHoldingRemMonths = Math.floor(avgHoldingMonths % 12);

  // Feature: Top 3 by cashflow
  const top3Cashflow = [...properties].sort((a, b) => b.monthlyCashflow - a.monthlyCashflow).slice(0, 3);

  // Feature: Portfolio share text
  const sharePortfolio = () => {
    const text = `📊 ImmoControl Portfolio\n${stats.propertyCount} Objekte · ${stats.totalUnits} Einheiten\n💰 Gesamtwert: ${formatCurrency(stats.totalValue)}\n📈 Eigenkapital: ${formatCurrency(stats.equity)}\n🏠 Miete: ${formatCurrency(stats.totalRent)}/M\n💵 Cashflow: ${formatCurrency(stats.totalCashflow)}/M\n📊 Brutto-Rendite: ${stats.avgRendite.toFixed(1)}%`;
    navigator.clipboard.writeText(text);
    toast.success("Portfolio-Zusammenfassung kopiert!");
  };

  // New Feature: LTV ratio
  const portfolioLTV = stats.totalValue > 0 ? (stats.totalDebt / stats.totalValue * 100) : 0;
  // New Feature: Vacancy rate from tenants
  const totalUnitsFromProps = properties.reduce((s, p) => s + p.units, 0);
  const occupiedUnits = allTenants.filter(t => t.is_active).length;
  const vacancyRate = totalUnitsFromProps > 0 ? ((totalUnitsFromProps - occupiedUnits) / totalUnitsFromProps * 100) : 0;
  // New Feature: Annual income
  const annualIncome = stats.totalRent * 12;
  const annualCashflow = stats.totalCashflow * 12;

  return (
    <div className="space-y-6" role="main" aria-label="Portfolio Dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-sm text-muted-foreground mt-1" aria-live="polite">
            {stats.propertyCount} Objekte · {stats.totalUnits} Einheiten · {totalSqm.toLocaleString("de-DE")} m²
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <QuickCalculator />
          <PropertyComparison />
          <HandoverProtocol />
          <RentIncreaseLetter />
          <SelbstauskunftGenerator />
          <FinanceExportDialog />
          <AddPropertyDialog />
        </div>
      </div>

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

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Gesamtwert"
          value={formatCurrency(stats.totalValue)}
          subValue={`${stats.appreciation >= 0 ? "+" : ""}${stats.appreciation.toFixed(1)}% Wertzuwachs`}
          trend={stats.appreciation >= 0 ? "up" : "down"}
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

      {/* New: Quick KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="gradient-card rounded-xl border border-border p-3 text-center animate-fade-in" style={{ animationDelay: "210ms" }}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">LTV</p>
          <p className={`text-lg font-bold ${portfolioLTV <= 60 ? "text-profit" : portfolioLTV <= 80 ? "text-gold" : "text-loss"}`}>{portfolioLTV.toFixed(1)}%</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 text-center animate-fade-in" style={{ animationDelay: "220ms" }}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Leerstand</p>
          <p className={`text-lg font-bold ${vacancyRate === 0 ? "text-profit" : vacancyRate <= 10 ? "text-gold" : "text-loss"}`}>{vacancyRate.toFixed(0)}%</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 text-center animate-fade-in" style={{ animationDelay: "230ms" }}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Jahresmiete</p>
          <p className="text-lg font-bold">{formatCurrency(annualIncome)}</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 text-center animate-fade-in" style={{ animationDelay: "240ms" }}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Jahres-Cashflow</p>
          <p className={`text-lg font-bold ${annualCashflow >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(annualCashflow)}</p>
        </div>
      </div>

      {/* Debt overview + Improvement 3: Monthly cost summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Restschuld gesamt</span>
            </div>
            <span className="text-lg font-bold">{formatCurrency(stats.totalDebt)}</span>
          </div>
          <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full progress-animated"
              style={{ width: `${stats.totalValue > 0 ? ((stats.totalValue - stats.totalDebt) / stats.totalValue) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>Tilgungsfortschritt</span>
            <span>{stats.totalValue > 0 ? (((stats.totalValue - stats.totalDebt) / stats.totalValue) * 100).toFixed(0) : 0}%</span>
          </div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in" style={{ animationDelay: "220ms" }}>
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

      {/* Feature: Average holding period */}
      {properties.length > 0 && (
        <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in flex items-center gap-3" style={{ animationDelay: "240ms" }}>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ø Haltedauer</p>
            <p className="text-sm font-semibold">
              {avgHoldingYears > 0 ? `${avgHoldingYears} Jahre ${avgHoldingRemMonths} Monate` : `${avgHoldingRemMonths} Monate`}
            </p>
          </div>
        </div>
      )}

      {/* Feature: Best/Worst performer */}
      {properties.length >= 2 && bestPerformer && worstPerformer && bestPerformer.id !== worstPerformer.id && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: "260ms" }}>
          <div className="gradient-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Bester Cashflow</p>
              <p className="text-sm font-semibold truncate">{bestPerformer.name}</p>
              <p className="text-xs text-profit font-medium">{formatCurrency(bestPerformer.monthlyCashflow)}/M</p>
            </div>
          </div>
          <div className="gradient-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-loss" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Schwächster Cashflow</p>
              <p className="text-sm font-semibold truncate">{worstPerformer.name}</p>
              <p className={`text-xs font-medium ${worstPerformer.monthlyCashflow >= 0 ? "text-profit" : "text-loss"}`}>
                {formatCurrency(worstPerformer.monthlyCashflow)}/M
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feature: Top 3 Cashflow Ranking */}
      {top3Cashflow.length >= 2 && (
        <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in" style={{ animationDelay: "280ms" }}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">🏆 Top 3 Cashflow</h3>
          <div className="space-y-2">
            {top3Cashflow.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-gold" : i === 1 ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${p.monthlyCashflow >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(p.monthlyCashflow)}/M
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Payment Banner */}
      <OverduePaymentBanner />

      {/* Debt/Equity + Net Worth */}
      <div className="grid md:grid-cols-2 gap-3">
        <DebtEquityWidget totalValue={stats.totalValue} totalDebt={stats.totalDebt} equity={stats.equity} />
        <NetWorthTracker currentEquity={stats.equity} totalValue={stats.totalValue} totalDebt={stats.totalDebt} />
      </div>

      {/* Tenant Lease Alerts */}
      <TenantLeaseAlerts propertyNames={Object.fromEntries(properties.map(p => [p.id, p.name]))} />

      {/* Action Center */}
      <DashboardActionCenter />

      {/* Charts */}
      <Suspense fallback={<div className="grid md:grid-cols-2 gap-3"><div className="h-64 bg-secondary/50 rounded-xl animate-pulse" /><div className="h-64 bg-secondary/50 rounded-xl animate-pulse" /></div>}>
        <div className="grid md:grid-cols-2 gap-3">
          <PortfolioChart />
          <CashflowChart />
        </div>
      </Suspense>

      {/* Monthly Overview */}
      <Suspense fallback={<div className="h-64 bg-secondary/50 rounded-xl animate-pulse" />}>
        <MonthlyOverviewChart />
      </Suspense>

      {/* Map */}
      <Suspense fallback={<div className="h-96 bg-secondary/50 rounded-xl animate-pulse" />}>
        <PropertyMap />
      </Suspense>

      {/* Feature 1: Search + Feature 2: Sort + Filter tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
          <button
            onClick={handleRefresh}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="Daten aktualisieren"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
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
          {(search || filter !== "alle") && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setSearch(""); setFilter("alle"); }}>
              Filter zurücksetzen
            </Button>
          )}
        </div>
      )}

      {/* Occupancy Tracker */}
      {allTenants.length > 0 && (
        <OccupancyTracker
          properties={properties.map(p => ({ id: p.id, name: p.name, units: p.units, monthlyRent: p.monthlyRent }))}
          tenants={allTenants}
        />
      )}

      {/* Yield Heatmap */}
      <YieldHeatmap properties={properties} />

      {/* Portfolio Type + Cashflow per sqm */}
      <div className="grid md:grid-cols-2 gap-3">
        <PortfolioTypeChart properties={properties} />
        <CashflowPerSqmWidget properties={properties} />
      </div>

      {/* Portfolio Goals + Quick Note */}
      <div className="grid md:grid-cols-2 gap-3">
        <PortfolioGoals currentStats={{ totalValue: stats.totalValue, totalCashflow: stats.totalCashflow, totalUnits: stats.totalUnits, equity: stats.equity }} />
        <QuickNoteWidget />
      </div>

      {/* Properties */}
      {filteredProperties.length === 0 ? (
        <div className="text-center py-12 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">Keine Ergebnisse</p>
          <p className="text-xs text-muted-foreground">Keine Objekte gefunden für „{search}"</p>
          <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={() => setSearch("")}>
            Suche zurücksetzen
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
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
  );
};

export default Dashboard;
