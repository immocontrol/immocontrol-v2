import { useMemo } from "react";
import { Building2, TrendingDown } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";

const HausgeldTracker = () => {
  const { properties } = useProperties();

  const wegProperties = useMemo(() => {
    return properties.filter(p => p.type === "ETW" || p.ownership === "egbr").map(p => {
      // Estimate Hausgeld as percentage of expenses
      const estimatedHausgeld = p.monthlyExpenses * 0.7; // ~70% of expenses is typically Hausgeld
      const notUmlegbar = estimatedHausgeld * 0.3; // ~30% not recoverable from tenants
      return {
        name: p.name,
        hausgeld: estimatedHausgeld,
        notUmlegbar,
        umlegbar: estimatedHausgeld - notUmlegbar,
        monthlyRent: p.monthlyRent,
        hausgeldQuote: p.monthlyRent > 0 ? (estimatedHausgeld / p.monthlyRent) * 100 : 0,
      };
    });
  }, [properties]);

  if (wegProperties.length === 0) return null;

  const totalHausgeld = wegProperties.reduce((s, p) => s + p.hausgeld, 0);
  const totalNotUmlegbar = wegProperties.reduce((s, p) => s + p.notUmlegbar, 0);

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Building2 className="h-4 w-4 text-muted-foreground" /> Hausgeld-Tracker (WEG)
        <span className="text-xs text-muted-foreground font-normal">{formatCurrency(totalHausgeld)}/M</span>
      </h3>
      <div className="space-y-2">
        {wegProperties.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-secondary/30">
            <div className="min-w-0">
              <span className="font-medium truncate block">{p.name}</span>
              <span className="text-[10px] text-muted-foreground">
                Umlegbar: {formatCurrency(p.umlegbar)} · Nicht umlegbar: {formatCurrency(p.notUmlegbar)}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="font-semibold">{formatCurrency(p.hausgeld)}/M</span>
              <span className={`block text-[10px] ${p.hausgeldQuote > 40 ? "text-loss" : "text-muted-foreground"}`}>
                {p.hausgeldQuote.toFixed(0)}% der Miete
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 p-2 rounded-lg bg-loss/5 text-xs flex items-center gap-2">
        <TrendingDown className="h-3.5 w-3.5 text-loss" />
        <span className="text-muted-foreground">Nicht umlegbare Kosten:</span>
        <span className="font-semibold text-loss">{formatCurrency(totalNotUmlegbar)}/M</span>
      </div>
    </div>
  );
};

export default HausgeldTracker;