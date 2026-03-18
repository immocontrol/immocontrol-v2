import { useMemo } from "react";
import { Trophy, Star, Target, TrendingUp, Building2, Wallet, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";

const PortfolioMilestones = () => {
  const { properties, stats } = useProperties();

  const milestones = useMemo(() => {
    if (properties.length === 0) return [];
    const items = [
      { icon: Building2, label: "Erstes Objekt", target: 1, current: stats.propertyCount, unit: "Objekte", reached: stats.propertyCount >= 1 },
      { icon: Building2, label: "5 Objekte", target: 5, current: stats.propertyCount, unit: "Objekte", reached: stats.propertyCount >= 5 },
      { icon: Building2, label: "10 Objekte", target: 10, current: stats.propertyCount, unit: "Objekte", reached: stats.propertyCount >= 10 },
      { icon: Target, label: "€100k Eigenkapital", target: 100000, current: stats.equity, unit: "€", reached: stats.equity >= 100000 },
      { icon: Target, label: "€500k Eigenkapital", target: 500000, current: stats.equity, unit: "€", reached: stats.equity >= 500000 },
      { icon: Target, label: "€1M Eigenkapital", target: 1000000, current: stats.equity, unit: "€", reached: stats.equity >= 1000000 },
      { icon: Wallet, label: "Positiver Cashflow", target: 0, current: stats.totalCashflow, unit: "€/M", reached: stats.totalCashflow > 0 },
      { icon: Wallet, label: "€1.000/M Cashflow", target: 1000, current: stats.totalCashflow, unit: "€/M", reached: stats.totalCashflow >= 1000 },
      { icon: Wallet, label: "€5.000/M Cashflow", target: 5000, current: stats.totalCashflow, unit: "€/M", reached: stats.totalCashflow >= 5000 },
      { icon: TrendingUp, label: "5% Rendite", target: 5, current: stats.avgRendite, unit: "%", reached: stats.avgRendite >= 5 },
    ];
    return items;
  }, [properties, stats]);

  if (milestones.length === 0) return null;

  const reached = milestones.filter(m => m.reached).length;
  const nextMilestone = milestones.find(m => !m.reached);

  const handleShare = async () => {
    const text = `Ich habe ${reached} von ${milestones.length} Meilensteinen in ImmoControl erreicht!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "ImmoControl Meilensteine", text });
      } catch {
        try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
      }
    } else {
      try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    }
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" /> Meilensteine
          <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold">{reached}/{milestones.length}</span>
        </h3>
        {reached > 0 && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleShare} aria-label="Meilensteine teilen">
            <Share2 className="h-3.5 w-3.5" />
            Teilen
          </Button>
        )}
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
        <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${(reached / milestones.length) * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {milestones.map((m, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs p-1.5 rounded ${m.reached ? "text-profit" : "text-muted-foreground"}`}>
            {m.reached ? <Star className="h-3 w-3 text-gold fill-gold shrink-0" /> : <Star className="h-3 w-3 shrink-0" />}
            <span className={m.reached ? "line-through opacity-60" : ""}>{m.label}</span>
          </div>
        ))}
      </div>
      {nextMilestone && (
        <div className="mt-3 p-2 rounded-lg bg-primary/5 text-xs">
          <span className="text-muted-foreground">Nächstes Ziel: </span>
          <span className="font-semibold text-primary">{nextMilestone.label}</span>
        </div>
      )}
    </div>
  );
};

export default PortfolioMilestones;