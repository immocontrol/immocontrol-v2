import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ContractManagement from "@/components/ContractManagement";
import InvoiceManagement from "@/components/InvoiceManagement";
import ServiceContracts from "@/components/ServiceContracts";
import { Mietvertragsverwaltung } from "@/components/Mietvertragsverwaltung";
import ContractLifecycleManager from "@/components/ContractLifecycleManager";
import { ContractTemplates } from "@/components/ContractTemplates";
import { FileText, Receipt, Wrench, AlertTriangle, Clock, CalendarClock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";

const Vertraege = () => {
  const { user } = useAuth();

  // Summary stats across all contract types
  const { data: contractStats } = useQuery({
    queryKey: ["vertraege_stats"],
    queryFn: async () => {
      const [contracts, invoices, services] = await Promise.all([
        supabase.from("contracts").select("id, status, end_date, is_indefinite").eq("status", "active"),
        supabase.from("invoices").select("id, status, amount, due_date").eq("status", "offen"),
        supabase.from("service_contracts").select("id, status, end_date, annual_cost").eq("status", "active"),
      ]);
      const expiringContracts = (contracts.data || []).filter(c => {
        if (c.is_indefinite) return false;
        if (!c.end_date) return false;
        const daysLeft = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000);
        return daysLeft > 0 && daysLeft < 90;
      }).length;
      const overdueInvoicesList = (invoices.data || []).filter(i => i.due_date && new Date(i.due_date) < new Date());
      const overdueInvoices = overdueInvoicesList.length;
      const overdueInvoiceAmount = overdueInvoicesList.reduce((s, i) => s + Number(i.amount), 0);
      const openInvoiceAmount = (invoices.data || []).reduce((s, i) => s + Number(i.amount), 0);
      const totalServiceCost = (services.data || []).reduce((s, c) => s + Number(c.annual_cost), 0);
      return {
        activeContracts: (contracts.data || []).length,
        expiringContracts,
        openInvoices: (invoices.data || []).length,
        overdueInvoices,
        overdueInvoiceAmount,
        openInvoiceAmount,
        activeServices: (services.data || []).length,
        totalServiceCost,
      };
    },
    enabled: !!user,
  });

  /* IMP-41-10: Dynamic document title with contract count */
  useEffect(() => { document.title = `Verträge (${contractStats?.activeContracts ?? 0}) – ImmoControl`; }, [contractStats?.activeContracts]);

  /* IMPROVE-12: Memoize default stats to avoid object recreation on every render */
  const stats = useMemo(() => contractStats || { activeContracts: 0, expiringContracts: 0, openInvoices: 0, overdueInvoices: 0, overdueInvoiceAmount: 0, openInvoiceAmount: 0, activeServices: 0, totalServiceCost: 0 }, [contractStats]);

  /* IMPROVE-13: Total contract value summary for quick reference */
  const totalMonthlyBurn = useMemo(() => {
    return (stats.totalServiceCost / 12) + (stats.openInvoiceAmount / 12);
  }, [stats.totalServiceCost, stats.openInvoiceAmount]);

  return (
    /* IMP-16: ARIA landmark for Verträge page */
    <div className="space-y-6 max-w-5xl mx-auto" role="main" aria-label="Verträge und Verwaltung">
      {/* Improvement 8: Mobile responsive heading */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Verträge & Verwaltung</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {/* IMPROVE-14: Show total active items count in subtitle */}
          {stats.activeContracts + stats.activeServices} aktive Verträge · Mietverträge, Rechnungen und Dienstleister
        </p>
      </div>

      {/* IMP-41-11: Overdue invoice warning banner — alerts when invoices are past due */}
      {/* IMP-44-1: ARIA alert role on warning banners for screen reader accessibility */}
      {stats.overdueInvoices > 0 && (
        <div role="alert" className="rounded-xl border-2 border-loss/30 bg-loss/5 p-4 flex items-center gap-3 animate-fade-in">
          <div className="w-9 h-9 rounded-lg bg-loss/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-loss" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{stats.overdueInvoices} Rechnung{stats.overdueInvoices > 1 ? "en" : ""} überfällig ({formatCurrency(stats.overdueInvoiceAmount)})</p>
            <p className="text-xs text-muted-foreground">Bitte prüfe offene Rechnungen und mahne rechtzeitig.</p>
          </div>
        </div>
      )}

      {/* Renewal Warning Banner */}
      {/* IMP-44-2: ARIA alert role on expiring contract banner */}
      {stats.expiringContracts > 0 && (
        <div role="alert" className="rounded-xl border-2 border-gold/30 bg-gold/5 p-4 flex items-center gap-3 animate-fade-in">
          <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-gold" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{stats.expiringContracts} Vertrag{stats.expiringContracts > 1 ? "e laufen" : " läuft"} in den nächsten 90 Tagen aus</p>
            <p className="text-xs text-muted-foreground">Prüfe die Verlängerung oder Kündigung rechtzeitig.</p>
          </div>
        </div>
      )}

      {/* Improvement 9: Quick Stats with card-hover-glow */}
      {/* UPD-2: Add stagger animation to contract stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 card-stagger-enter">
        <div className="gradient-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mietverträge</p>
            <p className="text-sm font-bold">{stats.activeContracts} aktiv</p>
            {stats.expiringContracts > 0 && (
              <p className="text-[10px] text-gold flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" /> {stats.expiringContracts} laufen aus</p>
            )}
          </div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${stats.overdueInvoices > 0 ? "bg-loss/10" : "bg-gold/10"}`}>
            <Receipt className={`h-4 w-4 ${stats.overdueInvoices > 0 ? "text-loss" : "text-gold"}`} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Offene Rechnungen</p>
            <p className="text-sm font-bold">{stats.openInvoices} · {formatCurrency(stats.openInvoiceAmount)}</p>
            {stats.overdueInvoices > 0 && (
              <p className="text-[10px] text-loss">{stats.overdueInvoices} überfällig</p>
            )}
          </div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-profit/10 flex items-center justify-center shrink-0">
            <Wrench className="h-4 w-4 text-profit" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dienstleister</p>
            <p className="text-sm font-bold">{stats.activeServices} aktiv</p>
            <p className="text-[10px] text-muted-foreground">{formatCurrency(stats.totalServiceCost)}/Jahr</p>
          </div>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monatl. Fixkosten</p>
            {/* IMP-44-3: Use memoized totalMonthlyBurn instead of inline recalculation */}
            <p className="text-sm font-bold">{formatCurrency(totalMonthlyBurn)}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="mietvertraege" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="mietvertraege" className="flex items-center gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Miet</span>verträge
          </TabsTrigger>
          <TabsTrigger value="vertraege" className="flex items-center gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> Allgemein
          </TabsTrigger>
          <TabsTrigger value="rechnungen" className="flex items-center gap-1.5 text-xs">
            <Receipt className="h-3.5 w-3.5" /> Rechnungen
          </TabsTrigger>
          <TabsTrigger value="dienstleister" className="flex items-center gap-1.5 text-xs">
            <Wrench className="h-3.5 w-3.5" /> Dienstleister
          </TabsTrigger>
          <TabsTrigger value="lifecycle" className="flex items-center gap-1.5 text-xs">
            <CalendarClock className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Fristen</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mietvertraege"><Mietvertragsverwaltung /></TabsContent>
        <TabsContent value="vertraege"><ContractManagement /></TabsContent>
        <TabsContent value="rechnungen"><InvoiceManagement /></TabsContent>
        <TabsContent value="dienstleister"><ServiceContracts /></TabsContent>
        <TabsContent value="lifecycle"><ContractLifecycleManager /></TabsContent>
      </Tabs>

      {/* Vertragsvorlagen — moved from Dashboard */}
      <ContractTemplates />
    </div>
  );
};


export default Vertraege;
