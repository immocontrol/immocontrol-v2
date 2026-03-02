/**
 * LIFECYCLE-1: Vertrags-Lifecycle-Management
 * 
 * Features:
 * - Automatic reminders before contract end (90/60/30 days)
 * - Renewal options tracking
 * - Termination deadline tracking with Kündigungsfrist
 * - Index rent clause monitoring (Indexmietklausel)
 * - Visual timeline of contract lifecycle
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar, AlertTriangle, Clock, Bell, CheckCircle, TrendingUp,
  RefreshCw, Shield, FileText, ArrowRight, Timer, BarChart3
} from "lucide-react";
import { formatCurrency, formatDate, formatDaysUntil } from "@/lib/formatters";

interface ContractLifecycleItem {
  id: string;
  property_id: string;
  tenant_name: string;
  unit_number: string;
  contract_start: string;
  contract_end: string | null;
  is_indefinite: boolean;
  notice_period_months: number;
  base_rent: number;
  cold_rent: number;
  warm_rent: number;
  rent_increase_type: string;
  last_rent_increase: string | null;
  index_base_year: string | null;
  staffel_percent: number | null;
  staffel_interval_months: number | null;
  status: string;
}

/** LIFECYCLE-2: Calculate all lifecycle events for a contract */
function getLifecycleEvents(contract: ContractLifecycleItem) {
  const now = new Date();
  const events: Array<{
    type: "warning" | "danger" | "info" | "success";
    label: string;
    description: string;
    daysUntil: number;
    icon: typeof AlertTriangle;
  }> = [];

  // Contract end tracking
  if (!contract.is_indefinite && contract.contract_end) {
    const endDate = new Date(contract.contract_end);
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);

    // Notice deadline
    const noticeDeadline = new Date(endDate);
    noticeDeadline.setMonth(noticeDeadline.getMonth() - contract.notice_period_months);
    const daysUntilNotice = Math.ceil((noticeDeadline.getTime() - now.getTime()) / 86400000);

    if (daysLeft <= 0) {
      events.push({ type: "danger", label: "Vertrag abgelaufen", description: `Seit ${Math.abs(daysLeft)} Tagen abgelaufen`, daysUntil: daysLeft, icon: AlertTriangle });
    } else {
      // 90/60/30 day reminders
      if (daysLeft <= 30) {
        events.push({ type: "danger", label: "Vertragsende in 30 Tagen", description: `Endet am ${formatDate(contract.contract_end)}`, daysUntil: daysLeft, icon: AlertTriangle });
      } else if (daysLeft <= 60) {
        events.push({ type: "warning", label: "Vertragsende in 60 Tagen", description: `Endet am ${formatDate(contract.contract_end)}`, daysUntil: daysLeft, icon: Clock });
      } else if (daysLeft <= 90) {
        events.push({ type: "info", label: "Vertragsende in 90 Tagen", description: `Endet am ${formatDate(contract.contract_end)}`, daysUntil: daysLeft, icon: Calendar });
      }

      // Notice period warning
      if (daysUntilNotice <= 0) {
        events.push({ type: "danger", label: "Kündigungsfrist abgelaufen", description: `Frist war am ${formatDate(noticeDeadline.toISOString())}`, daysUntil: daysUntilNotice, icon: Bell });
      } else if (daysUntilNotice <= 30) {
        events.push({ type: "warning", label: "Kündigungsfrist bald", description: `Noch ${daysUntilNotice} Tage bis zur Frist`, daysUntil: daysUntilNotice, icon: Timer });
      }
    }
  }

  // Rent increase monitoring (§558 BGB)
  const COOLDOWN_MONTHS = 15;
  let nextIncreaseDate: Date;
  if (contract.last_rent_increase) {
    nextIncreaseDate = new Date(contract.last_rent_increase);
    nextIncreaseDate.setMonth(nextIncreaseDate.getMonth() + COOLDOWN_MONTHS);
  } else {
    nextIncreaseDate = new Date(contract.contract_start);
    nextIncreaseDate.setMonth(nextIncreaseDate.getMonth() + 12);
  }
  const daysUntilIncrease = Math.ceil((nextIncreaseDate.getTime() - now.getTime()) / 86400000);

  if (daysUntilIncrease <= 0) {
    events.push({ type: "success", label: "Mieterhöhung möglich", description: `Seit ${Math.abs(daysUntilIncrease)} Tagen möglich (§558 BGB)`, daysUntil: daysUntilIncrease, icon: TrendingUp });
  } else if (daysUntilIncrease <= 60) {
    events.push({ type: "info", label: "Mieterhöhung bald möglich", description: `In ${daysUntilIncrease} Tagen (§558 BGB)`, daysUntil: daysUntilIncrease, icon: TrendingUp });
  }

  // Index rent clause monitoring
  if (contract.rent_increase_type === "index") {
    events.push({ type: "info", label: "Indexmiete", description: "VPI-Prüfung empfohlen — Statistisches Bundesamt", daysUntil: 999, icon: BarChart3 });
  }

  // Staffelmiete monitoring
  if (contract.rent_increase_type === "staffel" && contract.staffel_interval_months && contract.staffel_percent) {
    const start = new Date(contract.contract_start);
    const monthsSinceStart = Math.floor((now.getTime() - start.getTime()) / (86400000 * 30.44));
    const nextStaffel = Math.ceil(monthsSinceStart / contract.staffel_interval_months) * contract.staffel_interval_months;
    const nextStaffelDate = new Date(start);
    nextStaffelDate.setMonth(nextStaffelDate.getMonth() + nextStaffel);
    const daysUntilStaffel = Math.ceil((nextStaffelDate.getTime() - now.getTime()) / 86400000);

    if (daysUntilStaffel <= 60 && daysUntilStaffel > 0) {
      events.push({ type: "info", label: `Staffelerhöhung +${contract.staffel_percent}%`, description: `Nächste Stufe in ${daysUntilStaffel} Tagen`, daysUntil: daysUntilStaffel, icon: TrendingUp });
    }
  }

  return events.sort((a, b) => a.daysUntil - b.daysUntil);
}

/** LIFECYCLE-3: Calculate contract progress percentage */
function getContractProgress(contract: ContractLifecycleItem): number {
  if (contract.is_indefinite || !contract.contract_end) return -1;
  const start = new Date(contract.contract_start).getTime();
  const end = new Date(contract.contract_end).getTime();
  const now = Date.now();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

type FilterMode = "all" | "expiring" | "increase" | "index";

export default function ContractLifecycleManager() {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [filter, setFilter] = useState<FilterMode>("all");

  const { data: contracts = [] } = useQuery({
    queryKey: ["lifecycle_contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mietvertraege")
        .select("*")
        .order("contract_end", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ContractLifecycleItem[];
    },
    enabled: !!user,
  });

  const getPropertyName = (pid: string) => properties.find(p => p.id === pid)?.name || "–";

  /** LIFECYCLE-4: Contracts with lifecycle events */
  const enrichedContracts = useMemo(() => {
    return contracts.map(c => ({
      ...c,
      events: getLifecycleEvents(c),
      progress: getContractProgress(c),
      propertyName: getPropertyName(c.property_id),
    }));
  }, [contracts, properties]);

  /** LIFECYCLE-5: Filter logic */
  const filtered = useMemo(() => {
    switch (filter) {
      case "expiring":
        return enrichedContracts.filter(c => c.events.some(e => e.label.includes("Vertragsende") || e.label.includes("abgelaufen")));
      case "increase":
        return enrichedContracts.filter(c => c.events.some(e => e.label.includes("Mieterhöhung")));
      case "index":
        return enrichedContracts.filter(c => c.events.some(e => e.label.includes("Indexmiete") || e.label.includes("Staffel")));
      default:
        return enrichedContracts;
    }
  }, [enrichedContracts, filter]);

  /** LIFECYCLE-6: Summary stats */
  const summary = useMemo(() => {
    const expiring30 = enrichedContracts.filter(c => !c.is_indefinite && c.contract_end && Math.ceil((new Date(c.contract_end).getTime() - Date.now()) / 86400000) <= 30 && Math.ceil((new Date(c.contract_end).getTime() - Date.now()) / 86400000) > 0).length;
    const expiring90 = enrichedContracts.filter(c => !c.is_indefinite && c.contract_end && Math.ceil((new Date(c.contract_end).getTime() - Date.now()) / 86400000) <= 90 && Math.ceil((new Date(c.contract_end).getTime() - Date.now()) / 86400000) > 0).length;
    const canIncrease = enrichedContracts.filter(c => c.events.some(e => e.label === "Mieterhöhung möglich")).length;
    const indexContracts = enrichedContracts.filter(c => c.events.some(e => e.label === "Indexmiete")).length;
    const totalRent = enrichedContracts.reduce((s, c) => s + Number(c.warm_rent), 0);
    return { expiring30, expiring90, canIncrease, indexContracts, totalRent, total: enrichedContracts.length };
  }, [enrichedContracts]);

  const eventTypeColor = {
    danger: "text-loss bg-loss/10 border-loss/20",
    warning: "text-gold bg-gold/10 border-gold/20",
    info: "text-primary bg-primary/10 border-primary/20",
    success: "text-profit bg-profit/10 border-profit/20",
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setFilter("all")}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Verträge</p>
              <p className="text-sm font-bold">{summary.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 cursor-pointer hover:border-loss/30 transition-colors" onClick={() => setFilter("expiring")}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-loss/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-loss" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Auslaufend</p>
              <p className="text-sm font-bold">{summary.expiring90} <span className="text-xs font-normal text-muted-foreground">({summary.expiring30} &lt;30T)</span></p>
            </div>
          </div>
        </Card>
        <Card className="p-3 cursor-pointer hover:border-profit/30 transition-colors" onClick={() => setFilter("increase")}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-profit/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-profit" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Erhöhung</p>
              <p className="text-sm font-bold">{summary.canIncrease}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setFilter("index")}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Indexmiete</p>
              <p className="text-sm font-bold">{summary.indexContracts}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter indicator */}
      {filter !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{filter === "expiring" ? "Auslaufende" : filter === "increase" ? "Erhöhung möglich" : "Indexmiete"}</Badge>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setFilter("all")}>
            Alle anzeigen
          </Button>
        </div>
      )}

      {/* Contract Timeline Cards */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {contracts.length === 0 ? "Noch keine Mietverträge angelegt." : "Keine Verträge für diesen Filter."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(contract => (
            <Card key={contract.id} className="p-4 hover:border-primary/20 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Contract Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{contract.tenant_name}</span>
                    <Badge variant="outline" className="text-[10px]">{contract.unit_number}</Badge>
                    <span className="text-xs text-muted-foreground">{contract.propertyName}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{formatDate(contract.contract_start)} {contract.contract_end ? `→ ${formatDate(contract.contract_end)}` : "→ unbefristet"}</span>
                    <span className="font-medium text-foreground">{formatCurrency(contract.warm_rent)}/M</span>
                  </div>

                  {/* Progress Bar for fixed-term contracts */}
                  {contract.progress >= 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Vertragslaufzeit</span>
                        <span>{contract.progress}%</span>
                      </div>
                      <Progress
                        value={contract.progress}
                        className="h-1.5"
                      />
                    </div>
                  )}
                </div>

                {/* Events */}
                <div className="flex flex-col gap-1.5 sm:items-end shrink-0">
                  {contract.events.length === 0 ? (
                    <Badge variant="outline" className="text-[10px] gap-1 text-profit border-profit/20">
                      <CheckCircle className="h-3 w-3" /> Alles in Ordnung
                    </Badge>
                  ) : (
                    contract.events.slice(0, 3).map((event, idx) => {
                      const Icon = event.icon;
                      return (
                        <Tooltip key={idx}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className={`text-[10px] gap-1 cursor-help ${eventTypeColor[event.type]}`}
                            >
                              <Icon className="h-3 w-3" /> {event.label}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{event.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
