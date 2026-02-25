import { useMemo } from "react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";
import { AlertTriangle, CheckCircle } from "lucide-react";

const PortfolioAllocationWidget = () => {
  const { properties, stats } = useProperties();

  const allocation = useMemo(() => {
    if (properties.length < 2) return null;

    const byType: Record<string, { count: number; value: number }> = {};
    const byLocation: Record<string, { count: number; value: number }> = {};

    properties.forEach(p => {
      if (!byType[p.type]) byType[p.type] = { count: 0, value: 0 };
      byType[p.type].count++;
      byType[p.type].value += p.currentValue;

      const loc = p.location || "Unbekannt";
      if (!byLocation[loc]) byLocation[loc] = { count: 0, value: 0 };
      byLocation[loc].count++;
      byLocation[loc].value += p.currentValue;
    });

    const maxTypeShare = Math.max(...Object.values(byType).map(v => v.value / stats.totalValue * 100));
    const maxLocationShare = Math.max(...Object.values(byLocation).map(v => v.value / stats.totalValue * 100));

    const suggestions: string[] = [];
    if (maxTypeShare > 70) suggestions.push("Hohe Konzentration auf einen Objekttyp – diversifizieren");
    if (maxLocationShare > 70) suggestions.push("Starke regionale Konzentration – geografisch streuen");
    if (stats.totalDebt / stats.totalValue > 0.8) suggestions.push("LTV über 80% – Eigenkapitalaufbau priorisieren");

    const overallScore = 100 - (maxTypeShare * 0.3 + maxLocationShare * 0.3 + (stats.totalDebt / stats.totalValue * 100) * 0.4);

    return {
      byType: Object.entries(byType).map(([k, v]) => ({ name: k, share: v.value / stats.totalValue * 100, value: v.value, count: v.count })).sort((a, b) => b.share - a.share),
      byLocation: Object.entries(byLocation).map(([k, v]) => ({ name: k, share: v.value / stats.totalValue * 100, value: v.value, count: v.count })).sort((a, b) => b.share - a.share),
      suggestions,
      score: Math.max(0, Math.min(100, overallScore)),
    };
  }, [properties, stats]);

  if (!allocation) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Portfolio-Allokation</h3>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${allocation.score >= 70 ? "bg-profit/10 text-profit" : allocation.score >= 40 ? "bg-gold/10 text-gold" : "bg-loss/10 text-loss"}`}>
          Score: {allocation.score.toFixed(0)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Nach Typ</p>
          {allocation.byType.slice(0, 4).map(t => (
            <div key={t.name} className="flex items-center justify-between text-xs mb-1">
              <span className="truncate">{t.name}</span>
              <span className={`font-medium ${t.share > 60 ? "text-gold" : "text-muted-foreground"}`}>{t.share.toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Nach Standort</p>
          {allocation.byLocation.slice(0, 4).map(l => (
            <div key={l.name} className="flex items-center justify-between text-xs mb-1">
              <span className="truncate">{l.name}</span>
              <span className={`font-medium ${l.share > 60 ? "text-gold" : "text-muted-foreground"}`}>{l.share.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {allocation.suggestions.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border">
          {allocation.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-gold">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              {s}
            </div>
          ))}
        </div>
      )}

      {allocation.suggestions.length === 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-profit pt-2 border-t border-border">
          <CheckCircle className="h-3 w-3" />
          Gute Diversifikation – keine Handlungsempfehlung
        </div>
      )}
    </div>
  );
};

export default PortfolioAllocationWidget;
