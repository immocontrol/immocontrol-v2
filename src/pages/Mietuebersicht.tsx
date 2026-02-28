import { useState, useEffect, useMemo } from "react";
import { Receipt, Search, X, CheckCircle, Clock, AlertCircle, Filter } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Mietuebersicht = () => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [propertyFilter, setPropertyFilter] = useState("alle");
  const [monthFilter, setMonthFilter] = useState("alle");

  useEffect(() => { document.title = "Mietübersicht – ImmoControl"; }, []);

  const { data: tenants = [] } = useQuery({
    queryKey: ["mietuebersicht_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*").order("last_name");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["mietuebersicht_payments"],
    queryFn: async () => {
      const { data } = await supabase.from("rent_payments").select("*").order("due_date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

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

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
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
  }, [payments, statusFilter, propertyFilter, monthFilter, debouncedSearch, tenantMap, propertyMap]);

  // Stats
  const totalDue = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);
  const confirmed = filteredPayments.filter(p => p.status === "confirmed");
  const totalConfirmed = confirmed.reduce((s, p) => s + Number(p.amount), 0);
  const overdue = filteredPayments.filter(p => p.status === "overdue");
  const totalOverdue = overdue.reduce((s, p) => s + Number(p.amount), 0);
  const pending = filteredPayments.filter(p => p.status === "pending");
  const collectionRate = totalDue > 0 ? Math.round((totalConfirmed / totalDue) * 100) : 0;

  // Active tenants with rent
  const activeTenants = tenants.filter(t => t.is_active);
  const totalMonthlyRent = activeTenants.reduce((s, t) => s + Number(t.monthly_rent || 0), 0);

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

  return (
    <div className="space-y-6" role="main" aria-label="Mietübersicht">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mietübersicht</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activeTenants.length} aktive Mieter · {formatCurrency(totalMonthlyRent)} Soll-Miete/Monat
          {totalDue > 0 && (
            <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              collectionRate >= 90 ? "bg-profit/10 text-profit" : collectionRate >= 70 ? "bg-gold/10 text-gold" : "bg-loss/10 text-loss"
            }`}>
              {collectionRate}% Eingangsquote
            </span>
          )}
        </p>
      </div>

      <Tabs defaultValue="zahlungen" className="w-full">
        <TabsList>
          <TabsTrigger value="zahlungen">Zahlungen</TabsTrigger>
          <TabsTrigger value="mahnwesen">Mahnwesen</TabsTrigger>
          <TabsTrigger value="trend">Trend</TabsTrigger>
          <TabsTrigger value="bank">Bank-Abgleich</TabsTrigger>
        </TabsList>

        <TabsContent value="zahlungen" className="space-y-6 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Soll gesamt</div>
              <div className="text-xl font-bold">{formatCurrency(totalDue)}</div>
              <div className="text-[10px] text-muted-foreground">{filteredPayments.length} Buchungen</div>
            </div>
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Eingegangen</div>
              <div className="text-xl font-bold text-profit">{formatCurrency(totalConfirmed)}</div>
              <div className="text-[10px] text-muted-foreground">{confirmed.length} bestätigt</div>
            </div>
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Überfällig</div>
              <div className="text-xl font-bold text-loss">{formatCurrency(totalOverdue)}</div>
              <div className="text-[10px] text-muted-foreground">{overdue.length} Zahlungen</div>
            </div>
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Offen</div>
              <div className="text-xl font-bold text-gold">{formatCurrency(pending.reduce((s, p) => s + Number(p.amount), 0))}</div>
              <div className="text-[10px] text-muted-foreground">{pending.length} ausstehend</div>
            </div>
          </div>

          {/* Vermietungsquote */}
          {properties.length > 0 && (
            <div className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vermietungsquote</span>
                <span className="text-sm font-bold">
                  {properties.reduce((s, p) => s + p.units, 0) > 0
                    ? `${((activeTenants.length / properties.reduce((s, p) => s + p.units, 0)) * 100).toFixed(0)}%`
                    : "–"
                  }
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-profit rounded-full transition-all"
                  style={{ width: `${properties.reduce((s, p) => s + p.units, 0) > 0 ? (activeTenants.length / properties.reduce((s, p) => s + p.units, 0)) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{activeTenants.length} vermietet</span>
                <span>{properties.reduce((s, p) => s + p.units, 0) - activeTenants.length} leer</span>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Mieter oder Objekt suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
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
            <div className="text-center py-12 animate-fade-in">
              <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Keine Zahlungen gefunden</p>
              <p className="text-xs text-muted-foreground mt-1">Erstelle Mietzahlungen bei den einzelnen Objekten</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredPayments.map(p => {
                const tenant = tenantMap[p.tenant_id];
                const property = propertyMap[p.property_id];
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                    {statusIcon(p.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
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
