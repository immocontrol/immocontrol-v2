/**
 * MOB2-1: Mobile Property-Detail als Bottom Sheet
 * On mobile, property KPIs are shown in a peek-able bottom sheet overlay.
 * Swipe up to see full detail, swipe down to dismiss.
 */
import { memo, useMemo } from "react";
import { TrendingUp, Wallet, Landmark, CreditCard, Percent, BarChart3 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency } from "@/lib/formatters";
import { MobileBottomSheet } from "./MobileBottomSheet";
import { cn } from "@/lib/utils";

interface PropertyKPIs {
  name: string;
  address: string;
  currentValue: number;
  purchasePrice: number;
  monthlyRent: number;
  monthlyCashflow: number;
  monthlyExpenses: number;
  monthlyCreditRate: number;
  remainingDebt: number;
  interestRate: number;
  sqm: number;
  units: number;
}

interface MobilePropertyDetailSheetProps {
  open: boolean;
  onClose: () => void;
  property: PropertyKPIs | null;
}

export const MobilePropertyDetailSheet = memo(function MobilePropertyDetailSheet({
  open, onClose, property,
}: MobilePropertyDetailSheetProps) {
  const isMobile = useIsMobile();

  const metrics = useMemo(() => {
    if (!property) return null;
    const bruttoRendite = property.purchasePrice > 0
      ? ((property.monthlyRent * 12) / property.purchasePrice) * 100 : 0;
    const nettoRendite = property.purchasePrice > 0
      ? (((property.monthlyRent - property.monthlyExpenses) * 12) / property.purchasePrice) * 100 : 0;
    const appreciation = property.purchasePrice > 0
      ? ((property.currentValue - property.purchasePrice) / property.purchasePrice) * 100 : 0;
    const ltv = property.currentValue > 0
      ? (property.remainingDebt / property.currentValue) * 100 : 0;
    const tilgung = property.purchasePrice > 0
      ? ((property.purchasePrice - property.remainingDebt) / property.purchasePrice) * 100 : 0;
    return { bruttoRendite, nettoRendite, appreciation, ltv, tilgung };
  }, [property]);

  if (!property || !metrics || !isMobile) return null;

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      initialSnap="half"
      title={property.name}
      subtitle={property.address}
    >
      <div className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            icon={<Landmark className="h-4 w-4" />}
            label="Aktueller Wert"
            value={formatCurrency(property.currentValue)}
            subValue={`${metrics.appreciation >= 0 ? "+" : ""}${metrics.appreciation.toFixed(1)}%`}
            trend={metrics.appreciation >= 0 ? "up" : "down"}
          />
          <KPICard
            icon={<Wallet className="h-4 w-4" />}
            label="Cashflow/Monat"
            value={formatCurrency(property.monthlyCashflow)}
            subValue={`${formatCurrency(property.monthlyCashflow * 12)}/Jahr`}
            trend={property.monthlyCashflow >= 0 ? "up" : "down"}
          />
          <KPICard
            icon={<Percent className="h-4 w-4" />}
            label="Brutto-Rendite"
            value={`${metrics.bruttoRendite.toFixed(2)}%`}
            good={metrics.bruttoRendite >= 5}
            mid={metrics.bruttoRendite >= 3}
          />
          <KPICard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Netto-Rendite"
            value={`${metrics.nettoRendite.toFixed(2)}%`}
            good={metrics.nettoRendite >= 3}
            mid={metrics.nettoRendite >= 1.5}
          />
        </div>

        {/* Monthly Breakdown */}
        <div className="rounded-xl border border-border p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monatliche Übersicht</h4>
          <div className="space-y-1.5">
            <FlowRow label="Mieteinnahmen" value={property.monthlyRent} positive />
            <FlowRow label="Kreditrate" value={property.monthlyCreditRate} />
            <FlowRow label="Nebenkosten" value={property.monthlyExpenses} />
            <div className="border-t border-border pt-1.5 mt-1.5">
              <FlowRow
                label="Cashflow"
                value={Math.abs(property.monthlyCashflow)}
                positive={property.monthlyCashflow >= 0}
                bold
              />
            </div>
          </div>
        </div>

        {/* Financing Progress */}
        <div className="rounded-xl border border-border p-4 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Finanzierung</h4>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Restschuld</span>
            <span className="font-medium">{formatCurrency(property.remainingDebt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">LTV</span>
            <span className={cn("font-medium", metrics.ltv <= 60 ? "text-profit" : metrics.ltv <= 80 ? "text-gold" : "text-loss")}>
              {metrics.ltv.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.tilgung)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Getilgt: {metrics.tilgung.toFixed(0)}%</span>
            <span>{formatCurrency(property.purchasePrice - property.remainingDebt)}</span>
          </div>
        </div>
      </div>
    </MobileBottomSheet>
  );
});

/* Sub-components */
const KPICard = memo(function KPICard({ icon, label, value, subValue, trend, good, mid }: {
  icon: React.ReactNode; label: string; value: string; subValue?: string;
  trend?: "up" | "down"; good?: boolean; mid?: boolean;
}) {
  const colorClass = trend
    ? (trend === "up" ? "text-profit" : "text-loss")
    : (good ? "text-profit" : mid ? "text-gold" : "text-loss");

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn("text-lg font-bold", colorClass)}>{value}</div>
      {subValue && <div className="text-[10px] text-muted-foreground">{subValue}</div>}
    </div>
  );
});

const FlowRow = memo(function FlowRow({ label, value, positive, bold }: {
  label: string; value: number; positive?: boolean; bold?: boolean;
}) {
  return (
    <div className={cn("flex justify-between text-sm", bold && "font-semibold")}>
      <span className="text-muted-foreground">{label}</span>
      <span className={positive ? "text-profit" : "text-loss"}>
        {positive ? "+" : "-"}{formatCurrency(value)}
      </span>
    </div>
  );
});
