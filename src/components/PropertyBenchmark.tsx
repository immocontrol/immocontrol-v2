import { useMemo } from "react";
import { BarChart2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useProperties } from "@/context/PropertyContext";

interface PropertyBenchmarkProps {
  propertyId: string;
}

const Meter = ({ value, avg, label, format }: { value: number; avg: number; label: string; format: (v: number) => string }) => {
  const pct = avg > 0 ? (value / avg) * 100 : 100;
  const isGood = value >= avg;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`font-medium ${isGood ? "text-profit" : "text-loss"}`}>{format(value)}</span>
          <span className="text-muted-foreground text-[10px]">Ø {format(avg)}</span>
        </div>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden relative">
        <div className="h-full bg-secondary-foreground/20 rounded-full" style={{ width: "100%" }} />
        <div className={`absolute top-0 h-full rounded-full transition-all duration-500 ${isGood ? "bg-profit" : "bg-loss"}`} style={{ width: `${Math.min(pct, 200) / 2}%` }} />
        <div className="absolute top-0 left-1/2 h-full w-px bg-muted-foreground/40" />
      </div>
    </div>
  );
};

const PropertyBenchmark = ({ propertyId }: PropertyBenchmarkProps) => {
  const { properties } = useProperties();

  const { property, avgBrutto, avgCashflow, avgLtv, avgSqmRent } = useMemo(() => {
    const p = properties.find(x => x.id === propertyId);
    if (!p || properties.length < 2) return { property: p, avgBrutto: 0, avgCashflow: 0, avgLtv: 0, avgSqmRent: 0 };

    const others = properties.filter(x => x.id !== propertyId);
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

    return {
      property: p,
      avgBrutto: avg(others.map(x => x.purchasePrice > 0 ? (x.monthlyRent * 12 / x.purchasePrice) * 100 : 0)),
      avgCashflow: avg(others.map(x => x.monthlyCashflow)),
      avgLtv: avg(others.map(x => x.currentValue > 0 ? (x.remainingDebt / x.currentValue) * 100 : 0)),
      avgSqmRent: avg(others.map(x => x.sqm > 0 ? x.monthlyRent / x.sqm : 0)),
    };
  }, [properties, propertyId]);

  if (!property || properties.length < 2) return null;

  const brutto = property.purchasePrice > 0 ? (property.monthlyRent * 12 / property.purchasePrice) * 100 : 0;
  const ltv = property.currentValue > 0 ? (property.remainingDebt / property.currentValue) * 100 : 0;
  const sqmRent = property.sqm > 0 ? property.monthlyRent / property.sqm : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Benchmark vs. Portfolio</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">Mittelwert der anderen Objekte</span>
      </div>
      <div className="space-y-3">
        <Meter value={brutto} avg={avgBrutto} label="Brutto-Rendite" format={v => `${v.toFixed(1)}%`} />
        <Meter value={property.monthlyCashflow} avg={avgCashflow} label="Cashflow/M" format={formatCurrency} />
        <Meter value={sqmRent} avg={avgSqmRent} label="Miete/m²" format={v => `${v.toFixed(2)} €`} />
        <Meter value={100 - ltv} avg={100 - avgLtv} label="Eigenkapitalquote" format={v => `${v.toFixed(0)}%`} />
      </div>
    </div>
  );
};

export default PropertyBenchmark;
