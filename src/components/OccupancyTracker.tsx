import { useMemo } from "react";
import { Home, TrendingUp, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Property {
  id: string;
  name: string;
  units: number;
  monthlyRent: number;
}

interface Tenant {
  property_id: string;
  is_active: boolean;
  monthly_rent: number;
}

interface OccupancyTrackerProps {
  properties: Property[];
  tenants: Tenant[];
}

const OccupancyTracker = ({ properties, tenants }: OccupancyTrackerProps) => {
  const data = useMemo(() => {
    return properties.map(p => {
      const propTenants = tenants.filter(t => t.property_id === p.id && t.is_active);
      const occupied = propTenants.length;
      const pct = p.units > 0 ? (occupied / p.units) * 100 : 0;
      const actualRent = propTenants.reduce((s, t) => s + (t.monthly_rent || 0), 0);
      const potentialRent = p.monthlyRent;
      const vacancy = potentialRent - actualRent;
      return { ...p, occupied, pct, actualRent, vacancy };
    }).sort((a, b) => a.pct - b.pct);
  }, [properties, tenants]);

  const totalUnits = properties.reduce((s, p) => s + p.units, 0);
  const totalOccupied = data.reduce((s, d) => s + d.occupied, 0);
  const overallPct = totalUnits > 0 ? (totalOccupied / totalUnits) * 100 : 0;
  const totalVacancy = data.reduce((s, d) => s + d.vacancy, 0);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" /> Vermietungsstand
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${overallPct >= 90 ? "text-profit" : overallPct >= 70 ? "text-gold" : "text-loss"}`}>
            {overallPct.toFixed(0)}% belegt
          </span>
          {totalVacancy > 0 && (
            <span className="text-[10px] bg-loss/10 text-loss px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" /> -{formatCurrency(totalVacancy)}/M
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {data.map(d => (
          <div key={d.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium truncate max-w-[160px]">{d.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground">{d.occupied}/{d.units} Einh.</span>
                <span className={`font-medium ${d.pct >= 90 ? "text-profit" : d.pct >= 70 ? "text-gold" : "text-loss"}`}>
                  {d.pct.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${d.pct >= 90 ? "bg-profit" : d.pct >= 70 ? "bg-gold" : "bg-loss"}`}
                style={{ width: `${d.pct}%` }}
              />
            </div>
            {d.vacancy > 0 && (
              <p className="text-[10px] text-loss">Mietausfall: {formatCurrency(d.vacancy)}/Monat</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>{totalOccupied}/{totalUnits} Einheiten belegt</span>
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> {overallPct.toFixed(1)}% Auslastung
        </span>
      </div>
    </div>
  );
};

export default OccupancyTracker;
