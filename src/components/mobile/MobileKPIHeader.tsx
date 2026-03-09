/**
 * MOB-6: Mobile KPI Dashboard Header
 * Sticky header with 4 most important KPIs as horizontal scroll badges.
 * Always visible when scrolling, tap opens detail view.
 */
import { memo, useState, useCallback } from "react";
import { Building2, TrendingUp, Wallet, Percent, ChevronDown, ChevronUp } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHaptic } from "@/hooks/useHaptic";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface KPIItem {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  detail?: string;
}

interface MobileKPIHeaderProps {
  totalValue: number;
  totalCashflow: number;
  totalRent: number;
  /** Brutto-Rendite in % */
  yieldPercent: number;
  /** Total properties count */
  propertyCount: number;
  /** Occupancy rate 0-100 */
  occupancyRate?: number;
  className?: string;
}

export const MobileKPIHeader = memo(function MobileKPIHeader({
  totalValue, totalCashflow, totalRent, yieldPercent,
  propertyCount, occupancyRate, className,
}: MobileKPIHeaderProps) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    haptic.tap();
    setExpanded(prev => !prev);
  }, [haptic]);

  if (!isMobile) return null;

  const kpis: KPIItem[] = [
    {
      label: "Gesamtwert",
      value: formatCurrency(totalValue),
      icon: <Building2 className="h-3.5 w-3.5" />,
      detail: `${propertyCount} Objekte`,
    },
    {
      label: "Cashflow/M",
      value: formatCurrency(totalCashflow),
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      trendPositive: totalCashflow >= 0,
      detail: `${formatCurrency(totalCashflow * 12)}/Jahr`,
    },
    {
      label: "Kaltmiete/M",
      value: formatCurrency(totalRent),
      icon: <Wallet className="h-3.5 w-3.5" />,
      detail: `${formatCurrency(totalRent * 12)}/Jahr`,
    },
    {
      label: "Rendite",
      value: `${yieldPercent.toFixed(1)}%`,
      icon: <Percent className="h-3.5 w-3.5" />,
      trendPositive: yieldPercent >= 4,
      detail: occupancyRate !== undefined ? `Belegung: ${occupancyRate.toFixed(0)}%` : undefined,
    },
  ];

  return (
    <div className={cn("md:hidden", className)}>
      {/* Scrollable KPI badges */}
      <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            onClick={toggle}
            className="shrink-0 flex items-center gap-1.5 bg-secondary/50 border border-border/50 rounded-lg px-2.5 py-1.5 text-left active:scale-95 transition-transform"
          >
            <span className="text-muted-foreground">{kpi.icon}</span>
            <div className="min-w-0">
              <div className="text-[9px] text-muted-foreground leading-none">{kpi.label}</div>
              <div className={cn(
                "text-xs font-bold leading-tight",
                kpi.trendPositive === true && "text-profit",
                kpi.trendPositive === false && "text-loss",
              )}>
                {kpi.value}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Expanded detail view */}
      {expanded && (
        <div className="mt-2 gradient-card rounded-xl border border-border p-3 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold">Portfolio-Übersicht</span>
            <button onClick={toggle} className="p-1 rounded-md hover:bg-secondary">
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {kpi.icon}
                  {kpi.label}
                </div>
                <div className={cn(
                  "text-sm font-bold",
                  kpi.trendPositive === true && "text-profit",
                  kpi.trendPositive === false && "text-loss",
                )}>
                  {kpi.value}
                </div>
                {kpi.detail && (
                  <div className="text-[10px] text-muted-foreground">{kpi.detail}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
