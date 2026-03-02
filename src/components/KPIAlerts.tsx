/**
 * FEATURE-8: Dashboard KPI-Alerts
 *
 * Automatic alerts when key portfolio metrics change significantly:
 * - Vacancy rate increase
 * - Rental income drop
 * - Maintenance cost spike
 * - Debt-to-equity ratio change
 * - Cashflow turning negative
 *
 * Stores historical snapshots in localStorage and compares current vs previous.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Building2, Wallet, Wrench, Percent, Bell, X, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPercent, safeDivide } from "@/lib/formatters";

interface KPISnapshot {
  date: string;
  vacancyRate: number;
  totalRent: number;
  totalCashflow: number;
  maintenanceCosts: number;
  debtToEquity: number;
  occupancyRate: number;
  avgRentPerSqm: number;
}

interface KPIAlert {
  id: string;
  type: "vacancy" | "rent_drop" | "maintenance_spike" | "cashflow_negative" | "debt_ratio" | "occupancy" | "rent_per_sqm";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  icon: React.ReactNode;
  currentValue: string;
  previousValue: string;
  changePct: number;
}

const SNAPSHOT_KEY = "immo-kpi-snapshots";
const DISMISSED_KEY = "immo-kpi-dismissed";

function loadSnapshots(): KPISnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as KPISnapshot[]) : [];
  } catch {
    return [];
  }
}

function saveSnapshot(snapshot: KPISnapshot) {
  const snapshots = loadSnapshots();
  // Keep max 90 daily snapshots
  const today = new Date().toISOString().split("T")[0];
  const existing = snapshots.findIndex(s => s.date === today);
  if (existing >= 0) {
    snapshots[existing] = snapshot;
  } else {
    snapshots.push(snapshot);
  }
  // Trim to last 90
  const trimmed = snapshots.slice(-90);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(trimmed));
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

const KPIAlerts = () => {
  const { properties, stats } = useProperties();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [showSettings, setShowSettings] = useState(false);

  // Thresholds (configurable)
  const [thresholds] = useState({
    vacancyIncreasePct: 10, // Alert if vacancy rate increases by 10%+
    rentDropPct: 5,         // Alert if rent drops by 5%+
    maintenanceSpikePct: 30, // Alert if maintenance costs spike 30%+
    debtRatioMax: 80,       // Alert if debt-to-equity > 80%
    cashflowNegative: true, // Alert if total cashflow goes negative
  });

  // Fetch tenant data for occupancy
  const { data: allTenants = [] } = useQuery({
    queryKey: ["kpi_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("property_id, is_active, monthly_rent");
      return (data || []) as { property_id: string; is_active: boolean; monthly_rent: number }[];
    },
    enabled: !!user,
  });

  // Fetch maintenance costs
  const { data: maintenanceItems = [] } = useQuery({
    queryKey: ["kpi_maintenance"],
    queryFn: async () => {
      const { data } = await supabase.from("maintenance_items").select("estimated_cost, completed");
      return (data || []) as { estimated_cost: number; completed: boolean }[];
    },
    enabled: !!user,
  });

  // Current KPI snapshot
  const currentSnapshot = useMemo((): KPISnapshot => {
    const totalUnits = stats.totalUnits || properties.length;
    const occupiedUnits = properties.filter(p =>
      allTenants.some(t => t.property_id === p.id && t.is_active)
    ).length;
    const vacancyRate = safeDivide((totalUnits - occupiedUnits) * 100, totalUnits, 0);
    const occupancyRate = 100 - vacancyRate;
    const maintenanceCosts = maintenanceItems
      .filter(m => !m.completed)
      .reduce((s, m) => s + (m.estimated_cost || 0), 0);
    const debtToEquity = safeDivide(stats.totalDebt * 100, stats.equity, 0);
    const avgRentPerSqm = safeDivide(stats.totalRent, stats.totalSqm, 0);

    return {
      date: new Date().toISOString().split("T")[0],
      vacancyRate,
      totalRent: stats.totalRent,
      totalCashflow: stats.totalCashflow,
      maintenanceCosts,
      debtToEquity,
      occupancyRate,
      avgRentPerSqm,
    };
  }, [properties, stats, allTenants, maintenanceItems]);

  // Save snapshot on mount/update
  useEffect(() => {
    if (properties.length > 0) {
      saveSnapshot(currentSnapshot);
    }
  }, [currentSnapshot, properties.length]);

  // Generate alerts by comparing current to previous snapshot
  const alerts = useMemo((): KPIAlert[] => {
    const snapshots = loadSnapshots();
    if (snapshots.length < 2) return [];

    const previous = snapshots[snapshots.length - 2];
    const current = currentSnapshot;
    const result: KPIAlert[] = [];

    // 1. Vacancy rate increase
    if (previous.vacancyRate > 0 || current.vacancyRate > 0) {
      const change = current.vacancyRate - previous.vacancyRate;
      if (change >= thresholds.vacancyIncreasePct) {
        result.push({
          id: "vacancy-increase",
          type: "vacancy",
          severity: change >= 20 ? "critical" : "warning",
          title: "Leerstand gestiegen",
          message: `Leerstandsquote ist von ${formatPercent(previous.vacancyRate)} auf ${formatPercent(current.vacancyRate)} gestiegen.`,
          icon: <Building2 className="h-4 w-4" />,
          currentValue: formatPercent(current.vacancyRate),
          previousValue: formatPercent(previous.vacancyRate),
          changePct: change,
        });
      }
    }

    // 2. Rental income drop
    if (previous.totalRent > 0) {
      const rentChange = safeDivide((current.totalRent - previous.totalRent) * 100, previous.totalRent, 0);
      if (rentChange <= -thresholds.rentDropPct) {
        result.push({
          id: "rent-drop",
          type: "rent_drop",
          severity: rentChange <= -15 ? "critical" : "warning",
          title: "Mieteinnahmen gesunken",
          message: `Monatliche Mieteinnahmen sind um ${Math.abs(rentChange).toFixed(1)}% gesunken (${formatCurrency(previous.totalRent)} → ${formatCurrency(current.totalRent)}).`,
          icon: <TrendingDown className="h-4 w-4" />,
          currentValue: formatCurrency(current.totalRent),
          previousValue: formatCurrency(previous.totalRent),
          changePct: rentChange,
        });
      }
    }

    // 3. Maintenance cost spike
    if (previous.maintenanceCosts > 0) {
      const maintenanceChange = safeDivide((current.maintenanceCosts - previous.maintenanceCosts) * 100, previous.maintenanceCosts, 0);
      if (maintenanceChange >= thresholds.maintenanceSpikePct) {
        result.push({
          id: "maintenance-spike",
          type: "maintenance_spike",
          severity: maintenanceChange >= 50 ? "critical" : "warning",
          title: "Instandhaltungskosten gestiegen",
          message: `Geplante Instandhaltungskosten sind um ${maintenanceChange.toFixed(0)}% gestiegen (${formatCurrency(previous.maintenanceCosts)} → ${formatCurrency(current.maintenanceCosts)}).`,
          icon: <Wrench className="h-4 w-4" />,
          currentValue: formatCurrency(current.maintenanceCosts),
          previousValue: formatCurrency(previous.maintenanceCosts),
          changePct: maintenanceChange,
        });
      }
    }

    // 4. Cashflow turning negative
    if (thresholds.cashflowNegative && current.totalCashflow < 0 && previous.totalCashflow >= 0) {
      result.push({
        id: "cashflow-negative",
        type: "cashflow_negative",
        severity: "critical",
        title: "Cashflow negativ",
        message: `Der monatliche Cashflow ist negativ geworden: ${formatCurrency(current.totalCashflow)} (vorher: ${formatCurrency(previous.totalCashflow)}).`,
        icon: <Wallet className="h-4 w-4" />,
        currentValue: formatCurrency(current.totalCashflow),
        previousValue: formatCurrency(previous.totalCashflow),
        changePct: -100,
      });
    }

    // 5. Debt-to-equity ratio too high
    if (current.debtToEquity > thresholds.debtRatioMax) {
      result.push({
        id: "debt-ratio-high",
        type: "debt_ratio",
        severity: current.debtToEquity > 90 ? "critical" : "warning",
        title: "Verschuldungsgrad hoch",
        message: `Der Verschuldungsgrad liegt bei ${current.debtToEquity.toFixed(0)}% (Grenzwert: ${thresholds.debtRatioMax}%).`,
        icon: <Percent className="h-4 w-4" />,
        currentValue: formatPercent(current.debtToEquity),
        previousValue: formatPercent(previous.debtToEquity),
        changePct: current.debtToEquity - previous.debtToEquity,
      });
    }

    // 6. Rent per sqm drop
    if (previous.avgRentPerSqm > 0) {
      const sqmChange = safeDivide((current.avgRentPerSqm - previous.avgRentPerSqm) * 100, previous.avgRentPerSqm, 0);
      if (sqmChange <= -5) {
        result.push({
          id: "rent-sqm-drop",
          type: "rent_per_sqm",
          severity: "info",
          title: "Miete/m² gesunken",
          message: `Die durchschnittliche Miete pro m² ist um ${Math.abs(sqmChange).toFixed(1)}% gesunken.`,
          icon: <TrendingDown className="h-4 w-4" />,
          currentValue: `${current.avgRentPerSqm.toFixed(2)} €/m²`,
          previousValue: `${previous.avgRentPerSqm.toFixed(2)} €/m²`,
          changePct: sqmChange,
        });
      }
    }

    // Filter out dismissed alerts
    return result.filter(a => !dismissed.has(a.id));
  }, [currentSnapshot, thresholds, dismissed]);

  const dismissAlert = useCallback((id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    const allIds = new Set(alerts.map(a => a.id));
    setDismissed(prev => {
      const next = new Set([...prev, ...allIds]);
      saveDismissed(next);
      return next;
    });
  }, [alerts]);

  // Don't render if no alerts or no properties
  if (properties.length === 0 || alerts.length === 0) return null;

  const criticalCount = alerts.filter(a => a.severity === "critical").length;
  const warningCount = alerts.filter(a => a.severity === "warning").length;

  const severityColors: Record<string, string> = {
    critical: "bg-loss/10 border-loss/20 text-loss",
    warning: "bg-gold/10 border-gold/20 text-gold",
    info: "bg-primary/10 border-primary/20 text-primary",
  };

  const severityDot: Record<string, string> = {
    critical: "bg-loss",
    warning: "bg-gold",
    info: "bg-primary",
  };

  return (
    <div className="animate-fade-in">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 p-3 rounded-xl bg-loss/5 border border-loss/10 hover:bg-loss/10 transition-colors text-left">
            <Bell className="h-4 w-4 text-loss shrink-0" />
            <span className="text-sm font-semibold flex-1">
              KPI-Alerts
              {criticalCount > 0 && (
                <Badge variant="destructive" className="ml-2 text-[10px] h-4 px-1.5">
                  {criticalCount} kritisch
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1.5 border-gold/30 text-gold">
                  {warningCount} Warnung{warningCount > 1 ? "en" : ""}
                </Badge>
              )}
            </span>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-xl border ${severityColors[alert.severity]} transition-all`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityDot[alert.severity]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {alert.icon}
                  <span className="text-sm font-medium">{alert.title}</span>
                </div>
                <p className="text-xs opacity-80">{alert.message}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                  <span>Aktuell: <strong>{alert.currentValue}</strong></span>
                  <span>Vorher: {alert.previousValue}</span>
                  <span className={alert.changePct > 0 ? "text-loss" : "text-profit"}>
                    {alert.changePct > 0 ? "+" : ""}{alert.changePct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="p-1 rounded hover:bg-background/50 shrink-0"
                title="Ausblenden"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {alerts.length > 1 && (
            <Button variant="ghost" size="sm" onClick={dismissAll} className="w-full text-xs text-muted-foreground">
              Alle ausblenden
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default KPIAlerts;
