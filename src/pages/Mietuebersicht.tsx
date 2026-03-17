import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Receipt, Search, X, CircleCheck as CheckCircle, Clock, CircleAlert as AlertCircle, Filter, Download, TrendingUp, FileText, FileBarChart, Store, FileSignature, CalendarDays, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import BankMatching from "@/components/BankMatching";
import Mahnwesen from "@/components/Mahnwesen";
import MietTrendChart from "@/components/MietTrendChart";
import RentIncreaseWizard from "@/components/RentIncreaseWizard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { EmptyState } from "@/components/EmptyState";
import { MobileQuickStats } from "@/components/mobile/MobileQuickStats";
import { LeerstandskostenRechner } from "@/components/LeerstandskostenRechner";
import { MoveInOutChecklist } from "@/components/MoveInOutChecklist";
import { VacancyScenarios } from "@/components/VacancyScenarios";
import { InflationMietrechner } from "@/components/InflationMietrechner";
import { IndexMietanpassung } from "@/components/IndexMietanpassung";
import { TablePageSkeleton } from "@/components/PageSkeleton";

const Mietuebersicht = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyFromUrl = searchParams.get("property");
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(() => (tabFromUrl === "bank" || tabFromUrl === "mahnwesen" || tabFromUrl === "trend" ? tabFromUrl : "zahlungen"));
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [dueGroupFilter, setDueGroupFilter] = useState<"alle" | "overdue" | "7d" | "30d" | "later">("alle");
  const [propertyFilter, setPropertyFilter] = useState(() => propertyFromUrl || "alle");
  const [monthFilter, setMonthFilter] = useState("alle");

  useEffect(() => {
    if (propertyFromUrl && propertyFromUrl !== propertyFilter) setPropertyFilter(propertyFromUrl);
  }, [propertyFromUrl]);

  useEffect(() => {
    if (tabFromUrl === "bank" || tabFromUrl === "mahnwesen" || tabFromUrl === "trend") setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ["mietuebersicht_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*").order("last_name");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["mietuebersicht_payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rent_payments")
        .select("*, tenants(first_name, last_name, monthly_rent, is_active), properties(name, id)")
        .order("due_date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const isLoading = tenantsLoading || paymentsLoading;

  /* IMP-41-4: Dynamic document title with tenant count for browser tab clarity */
  useEffect(() => { document.title = `Mietübersicht (${tenants.filter(t => t.is_active).length}) – ImmoControl`; }, [tenants]);

  const tenantMap = useMemo(() => Object.fromEntries(tenants.map(t => [t.id, t])), [tenants]);
  const propertyMap = useMemo(() => Object.fromEntries(properties.map(p => [p.id, p])), [properties]);

  // Improvement 3: Available months for filter
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    payments.forEach(p => {
      const d = new Date(p.due_date);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(months).sort().reverse();
  }, [payments]);

  /* IMP-50: Offene Posten nach Fälligkeit gruppieren (Überfällig | In 7 Tagen | In 30 Tagen) */
  const { overduePayments, in7Days, in30Days, laterPayments } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const open = payments.filter(p => p.status === "pending" || p.status === "overdue");
    const od: typeof payments = [];
    const d7: typeof payments = [];
    const d30: typeof payments = [];
    const later: typeof payments = [];
    open.forEach(p => {
      const d = new Date(p.due_date); d.setHours(0, 0, 0, 0);
      if (d < today) od.push(p);
      else if (d <= in7) d7.push(p);
      else if (d <= in30) d30.push(p);
      else later.push(p);
    });
    return { overduePayments: od, in7Days: d7, in30Days: d30, laterPayments: later };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    let list = payments.filter(p => {
      if (statusFilter !== "alle" && p.status !== statusFilter) return false;
      if (propertyFilter !== "alle" && p.property_id !== propertyFilter) return false;
      if (monthFilter !== "alle") {
        const d = new Date(p.due_date);
        const pm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (pm !== monthFilter) return false;
      }
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const tenant = tenantMap[p.tenant_id];
        const property = propertyMap[p.property_id];
        const name = tenant ? `${tenant.first_name} ${tenant.last_name}`.toLowerCase() : "";
        const propName = property?.name?.toLowerCase() || "";
        return name.includes(q) || propName.includes(q);
      }
      return true;
    });
    if (dueGroupFilter !== "alle") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
      const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
      list = list.filter(p => {
        if (p.status !== "pending" && p.status !== "overdue") return false;
        const d = new Date(p.due_date); d.setHours(0, 0, 0, 0);
        if (dueGroupFilter === "overdue") return d < today;
        if (dueGroupFilter === "7d") return d >= today && d <= in7;
        if (dueGroupFilter === "30d") return d > in7 && d <= in30;
        if (dueGroupFilter === "later") return d > in30;
        return true;
      });
    }
    return list;
  }, [payments, statusFilter, propertyFilter, monthFilter, debouncedSearch, tenantMap, propertyMap, dueGroupFilter]);

  /* FUNC-22: Year-over-year payment trend */
  const paymentTrend = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const thisYearTotal = payments
      .filter(p => new Date(p.due_date).getFullYear() === currentYear && p.status === "confirmed")
      .reduce((s, p) => s + Number(p.amount), 0);
    const lastYearTotal = payments
      .filter(p => new Date(p.due_date).getFullYear() === lastYear && p.status === "confirmed")
      .reduce((s, p) => s + Number(p.amount), 0);
    const change = lastYearTotal > 0 ? ((thisYearTotal - lastYearTotal) / lastYearTotal * 100) : 0;
    return { thisYear: thisYearTotal, lastYear: lastYearTotal, change };
  }, [payments]);

  /* IMP20-10: Memoize inline stats — 7 reduce/filter calls were running on every render */
  const { totalDue, confirmed, totalConfirmed, overdue, totalOverdue, pending, collectionRate } = useMemo(() => {
    const due = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);
    const conf = filteredPayments.filter(p => p.status === "confirmed");
    const confTotal = conf.reduce((s, p) => s + Number(p.amount), 0);
    const od = filteredPayments.filter(p => p.status === "overdue");
    const odTotal = od.reduce((s, p) => s + Number(p.amount), 0);
    const pend = filteredPayments.filter(p => p.status === "pending");
    const rate = due > 0 ? Math.round((confTotal / due) * 100) : 0;
    return { totalDue: due, confirmed: conf, totalConfirmed: confTotal, overdue: od, totalOverdue: odTotal, pending: pend, collectionRate: rate };
  }, [filteredPayments]);

  // Active tenants with rent
  const activeTenants = useMemo(() => tenants.filter(t => t.is_active), [tenants]);
  const totalMonthlyRent = useMemo(() => activeTenants.reduce((s, t) => s + Number(t.monthly_rent || 0), 0), [activeTenants]);

  /* BUG-FIX: Memoize totalUnits — was calculated 3 times inline in JSX causing redundant reduce() calls */
  const totalUnits = useMemo(() => properties.reduce((s, p) => s + p.units, 0), [properties]);

  /* FUNC-23: Top paying tenants */
  const topTenants = useMemo(() => {
    return activeTenants
      .map(t => ({ ...t, rent: Number(t.monthly_rent || 0) }))
      .sort((a, b) => b.rent - a.rent)
      .slice(0, 5);
  }, [activeTenants]);

  /* FUNC-24: Payment method distribution */
  const paymentMethodDist = useMemo(() => {
    const methods: Record<string, number> = {};
    payments.forEach(p => {
      const method = typeof (p as { payment_method?: string }).payment_method === "string" ? (p as { payment_method?: string }).payment_method! : "Überweisung";
      methods[method] = (methods[method] || 0) + 1;
    });
    return methods;
  }, [payments]);

  /* IMP-31: Memoize stats to avoid recalculation on every render */
  /* IMP-37: Include pending amount in memoized stats */
  const stats = useMemo(() => {
    const pendingAmount = pending.reduce((s, p) => s + Number(p.amount), 0);
    return {
      totalDue,
      totalConfirmed,
      totalOverdue,
      collectionRate,
      pendingCount: pending.length,
      pendingAmount,
    };
  }, [totalDue, totalConfirmed, totalOverdue, collectionRate, pending]);

  /* IMP-41-9: CSV export for filtered rent payments — allows exporting the current view */
  const exportPaymentsCSV = useCallback(() => {
    if (filteredPayments.length === 0) return;
    const headers = ["Mieter", "Objekt", "Betrag", "Fällig", "Bezahlt", "Status"];
    const rows = filteredPayments.map(p => {
      const tenant = tenantMap[p.tenant_id];
      const property = propertyMap[p.property_id];
      return [
        tenant ? `${tenant.first_name} ${tenant.last_name}` : "–",
        property?.name || "–",
        Number(p.amount).toFixed(2),
        new Date(p.due_date).toLocaleDateString("de-DE"),
        p.paid_date ? new Date(p.paid_date).toLocaleDateString("de-DE") : "",
        p.status === "confirmed" ? "Bestätigt" : p.status === "overdue" ? "Überfällig" : "Offen",
      ];
    });
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mietzahlungen_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Zahlungen als CSV exportiert!");
  }, [filteredPayments, tenantMap, propertyMap]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "confirmed": return <CheckCircle className="h-3.5 w-3.5 text-profit" />;
      case "overdue": return <AlertCircle className="h-3.5 w-3.5 text-loss" />;
      case "cancelled": return <X className="h-3.5 w-3.5 text-muted-foreground" />;
      default: return <Clock className="h-3.5 w-3.5 text-gold" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "confirmed": return "Bestätigt";
      case "overdue": return "Überfällig";
      case "cancelled": return "Storniert";
      default: return "Offen";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 min-w-0" role="main" aria-label="Mietübersicht">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Mietübersicht</h1>
          <p className="text-sm text-muted-foreground mt-1">Zahlungen, Mahnwesen und Bank-Abgleich</p>
        </div>
        <TablePageSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0" role="main" aria-label="Mietübersicht">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Mietübersicht</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Zahlungen, Mahnwesen und Bank-Abgleich</p>
        <div className="flex items-center gap-x-2 gap-y-2 mt-1 flex-wrap min-w-0">
          <p className="text-sm text-muted-foreground">
            {activeTenants.length} aktive Mieter · {formatCurrency(totalMonthlyRent)} Soll-Miete/Monat
            {stats.totalDue > 0 && (
              <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                stats.collectionRate >= 90 ? "bg-profit/10 text-profit" : stats.collectionRate >= 70 ? "bg-gold/10 text-gold" : "bg-loss/10 text-loss"
              }`}>
                {stats.collectionRate}% Eingangsquote
              </span>
            )}
          </p>
          <RentIncreaseWizard />
          <Link to={ROUTES.HOME} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ml-2 touch-target min-h-[44px]">
            <TrendingUp className="h-3.5 w-3.5" /> Index-Mietanpassung prüfen
          </Link>
          <Link to={ROUTES.NK} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline ml-2 touch-target min-h-[44px]">
            <FileText className="h-3.5 w-3.5" /> Nebenkostenabrechnung
          </Link>
          <Link to={ROUTES.REPORTS} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ml-2 touch-target min-h-[44px]" aria-label="Zu Berichte">
            <FileBarChart className="h-3.5 w-3.5" /> Berichte
          </Link>
          <Link to={ROUTES.CRM_SCOUT} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ml-2 touch-target min-h-[44px]" aria-label="WGH finden">
            <Store className="h-3.5 w-3.5" /> WGH finden
          </Link>
          <Link to={ROUTES.CONTRACTS} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ml-2 touch-target min-h-[44px]" aria-label="Verträge und Kündigungsfrist">
            <FileSignature className="h-3.5 w-3.5" /> Verträge
          </Link>
          <Link to={ROUTES.FORECAST} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ml-2 touch-target min-h-[44px]" aria-label="Cashforecast">
            <CalendarDays className="h-3.5 w-3.5" /> Cashforecast
          </Link>
          <Link to={ROUTES.FINANZIERUNG} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ml-2 touch-target min-h-[44px]" aria-label="Finanzierungs-Cockpit">
            <Wallet className="h-3.5 w-3.5" /> Finanzierung
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchParams((p) => { const next = new URLSearchParams(p); if (v === "zahlungen") next.delete("tab"); else next.set("tab", v); return next; }); }} className="w-full">
        <TabsList>
          <TabsTrigger value="zahlungen">Zahlungen</TabsTrigger>
          <TabsTrigger value="mahnwesen">Mahnwesen</TabsTrigger>
          <TabsTrigger value="trend">Trend</TabsTrigger>
          <TabsTrigger value="bank">Bank-Abgleich</TabsTrigger>
        </TabsList>

        <TabsContent value="zahlungen" className="space-y-6 mt-4">
          <MobileQuickStats
            stats={[
              { id: "soll", label: "Soll", value: formatCurrency(stats.totalDue), href: undefined },
              { id: "eingegangen", label: "Eingegangen", value: formatCurrency(stats.totalConfirmed), color: "success", href: undefined },
              { id: "ueberfaellig", label: "Überfällig", value: formatCurrency(stats.totalOverdue), color: "destructive", href: ROUTES.RENT },
              { id: "offen", label: "Offen", value: formatCurrency(stats.pendingAmount), color: "warning", href: undefined },
            ]}
            showTrends={false}
          />
          {/* KPI Cards */}
          {/* UPD-1: Add stagger animation to KPI cards */}
          {/* IMP-44-8: Add aria-live region for payment stats so screen readers announce updates */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 card-stagger-enter" aria-live="polite" aria-label="Zahlungsstatistiken">
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Soll gesamt</div>
              <div className="text-xl font-bold">{formatCurrency(stats.totalDue)}</div>
              <div className="text-[10px] text-muted-foreground">{filteredPayments.length} Buchungen</div>
            </div>
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Eingegangen</div>
              <div className="text-xl font-bold text-profit">{formatCurrency(stats.totalConfirmed)}</div>
              <div className="text-[10px] text-muted-foreground">{confirmed.length} bestätigt</div>
            </div>
            {/* IMP-44-9: Add ARIA alert role on overdue amount card for screen reader urgency */}
            <div className="gradient-card rounded-xl border border-border p-4" role={overdue.length > 0 ? "alert" : undefined}>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Überfällig</div>
              <div className="text-xl font-bold text-loss">{formatCurrency(stats.totalOverdue)}</div>
              <div className="text-[10px] text-muted-foreground">{overdue.length} Zahlungen</div>
            </div>
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Offen</div>
              <div className="text-xl font-bold text-gold">{formatCurrency(stats.pendingAmount)}</div>
              <div className="text-[10px] text-muted-foreground">{stats.pendingCount} ausstehend</div>
            </div>
          </div>

          <LeerstandskostenRechner />
          <VacancyScenarios />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MoveInOutChecklist type="einzug" tenantOrUnitId="global" label="Nächster Mieter" />
            <MoveInOutChecklist type="auszug" tenantOrUnitId="global" label="Nächster Auszug" />
          </div>
          <InflationMietrechner />
          <IndexMietanpassung />

          {/* FUNC-22/23/24: Payment trend, top tenants, payment methods */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {paymentTrend.lastYear > 0 && (
              <div className="glass-card rounded-xl border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vorjahresvergleich</p>
                <p className={`text-lg font-bold ${paymentTrend.change >= 0 ? "text-profit" : "text-loss"}`}>
                  {paymentTrend.change >= 0 ? "+" : ""}{paymentTrend.change.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">{formatCurrency(paymentTrend.thisYear)} vs {formatCurrency(paymentTrend.lastYear)}</p>
              </div>
            )}
            {topTenants.length > 0 && (
              <div className="glass-card rounded-xl border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Top Mieter</p>
                {topTenants.slice(0, 3).map((t, i) => (
                  <div key={t.id} className="flex justify-between text-xs">
                    <span className="truncate">{i + 1}. {t.first_name} {t.last_name}</span>
                    <span className="font-medium">{formatCurrency(t.rent)}</span>
                  </div>
                ))}
              </div>
            )}
            {Object.keys(paymentMethodDist).length > 0 && (
              <div className="glass-card rounded-xl border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Zahlungsarten</p>
                {Object.entries(paymentMethodDist).map(([method, count]) => (
                  <div key={method} className="flex justify-between text-xs">
                    <span>{method}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vermietungsquote */}
          {properties.length > 0 && (
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vermietungsquote</span>
                <span className="text-sm font-bold">
                  {totalUnits > 0
                    ? `${((activeTenants.length / totalUnits) * 100).toFixed(0)}%`
                    : "–"
                  }
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-profit rounded-full transition-all"
                  style={{ width: `${totalUnits > 0 ? (activeTenants.length / totalUnits) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{activeTenants.length} vermietet</span>
                <span>{totalUnits - activeTenants.length} leer</span>
              </div>
            </div>
          )}

          {/* Filters */}
          {/* IMP-41-9: CSV export button for filtered payments */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{filteredPayments.length} Zahlungen</span>
            {filteredPayments.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={exportPaymentsCSV}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            )}
          </div>

          {/* IMP-50: Fälligkeits-Gruppen für offene Posten */}
          {(overduePayments.length > 0 || in7Days.length > 0 || in30Days.length > 0) && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center">Offene Posten:</span>
              {[
                { key: "overdue" as const, label: "Überfällig", count: overduePayments.length, color: "bg-loss/10 text-loss" },
                { key: "7d" as const, label: "In 7 Tagen", count: in7Days.length, color: "bg-gold/10 text-gold" },
                { key: "30d" as const, label: "In 30 Tagen", count: in30Days.length, color: "bg-primary/10 text-primary" },
              ].map(({ key, label, count, color }) => (
                <button
                  key={key}
                  onClick={() => setDueGroupFilter(dueGroupFilter === key ? "alle" : key)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${dueGroupFilter === key ? color : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}
                >
                  {label} ({count})
                </button>
              ))}
              {dueGroupFilter !== "alle" && (
                <button onClick={() => setDueGroupFilter("alle")} className="text-xs text-muted-foreground hover:text-primary">
                  Alle anzeigen
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="z. B. Mustermann oder Musterstraße" aria-label="Mieter oder Objekt suchen" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Status</SelectItem>
                <SelectItem value="pending">Offen</SelectItem>
                <SelectItem value="confirmed">Bestätigt</SelectItem>
                <SelectItem value="overdue">Überfällig</SelectItem>
              </SelectContent>
            </Select>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="h-9 w-[180px] text-sm"><SelectValue placeholder="Objekt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Objekte</SelectItem>
                {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Improvement 3: Month filter */}
            {availableMonths.length > 1 && (
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue placeholder="Monat" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Monate</SelectItem>
                  {availableMonths.map(m => {
                    const [y, mo] = m.split("-");
                    const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
                    return <SelectItem key={m} value={m}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Payment list */}
          {filteredPayments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Keine Zahlungen"
              description="Erstelle Mietzahlungen bei den Objekten mit Mietern – dann erscheinen sie hier."
              action={
                <Button size="sm" className="touch-target min-h-[44px] gap-1.5" onClick={() => navigate(ROUTES.OBJEKTE)}>
                  Zu Objekten
                </Button>
              }
            />
          ) : (
            <div className="space-y-1">
              {filteredPayments.map(p => {
                const tenant = tenantMap[p.tenant_id];
                const property = propertyMap[p.property_id];
                /* IMP-32: Add min-w-0 to prevent payment items from overflowing */
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors min-w-0">
                    {statusIcon(p.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* IMP-33: Limit tenant name width on mobile to prevent overflow */}
                        <span className="text-sm font-medium truncate max-w-[120px] sm:max-w-none">
                          {tenant ? `${tenant.first_name} ${tenant.last_name}` : "–"}
                        </span>
                        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded truncate">
                          {property?.name || "–"}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Fällig: {new Date(p.due_date).toLocaleDateString("de-DE")}
                        {p.paid_date && <span> · Bezahlt: {new Date(p.paid_date).toLocaleDateString("de-DE")}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(p.amount))}</div>
                      <div className={`text-[10px] font-medium ${p.status === "confirmed" ? "text-profit" : p.status === "overdue" ? "text-loss" : "text-gold"}`}>
                        {statusLabel(p.status)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mahnwesen" className="mt-4">
          <Mahnwesen />
        </TabsContent>

        <TabsContent value="trend" className="mt-4">
          <MietTrendChart />
        </TabsContent>

        <TabsContent value="bank" className="mt-4">
          <BankMatching />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Mietuebersicht;
