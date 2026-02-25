import { useMemo } from "react";
import { PieChart as PieIcon, MapPin, Home, Wallet } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/formatters";

const COLORS = ["hsl(var(--primary))", "hsl(var(--profit))", "hsl(var(--gold))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const DiversifikationsScore = () => {
  const { properties } = useProperties();

  const analysis = useMemo(() => {
    if (properties.length < 2) return null;

    // Type diversification
    const types: Record<string, number> = {};
    const locations: Record<string, number> = {};
    const ownershipSplit: Record<string, number> = {};
    let totalValue = 0;

    properties.forEach(p => {
      types[p.type] = (types[p.type] || 0) + p.currentValue;
      locations[p.location || p.address?.split(",").pop()?.trim() || "Unbekannt"] = (locations[p.location || "Unbekannt"] || 0) + p.currentValue;
      ownershipSplit[p.ownership] = (ownershipSplit[p.ownership] || 0) + p.currentValue;
      totalValue += p.currentValue;
    });

    // Herfindahl-Hirschman Index (lower = more diversified)
    const typeShares = Object.values(types).map(v => (v / totalValue) * 100);
    const locationShares = Object.values(locations).map(v => (v / totalValue) * 100);
    const typeHHI = typeShares.reduce((s, share) => s + share * share, 0);
    const locationHHI = locationShares.reduce((s, share) => s + share * share, 0);

    // Score 0-100 (100 = perfectly diversified)
    const maxHHI = 10000; // 100% in one category
    const typeScore = Math.max(0, 100 - (typeHHI / maxHHI * 100));
    const locationScore = Math.max(0, 100 - (locationHHI / maxHHI * 100));
    const overallScore = Math.round((typeScore * 0.4 + locationScore * 0.6));

    const typeData = Object.entries(types).map(([name, value]) => ({ name, value: Math.round(value), share: (value / totalValue * 100) }));
    const locationData = Object.entries(locations).map(([name, value]) => ({ name, value: Math.round(value), share: (value / totalValue * 100) }));

    return { overallScore, typeScore, locationScore, typeData, locationData, totalValue };
  }, [properties]);

  if (!analysis) return null;

  const scoreColor = analysis.overallScore >= 60 ? "text-profit" : analysis.overallScore >= 30 ? "text-gold" : "text-loss";
  const scoreLabel = analysis.overallScore >= 60 ? "Gut diversifiziert" : analysis.overallScore >= 30 ? "Ausbaufähig" : "Klumpenrisiko";

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-muted-foreground" /> Diversifikation
        </h3>
        <div className="text-right">
          <div className={`text-lg font-bold ${scoreColor}`}>{analysis.overallScore}/100</div>
          <div className="text-[10px] text-muted-foreground">{scoreLabel}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Type distribution */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Home className="h-3 w-3" /> Objekttypen
          </p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analysis.typeData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={25}>
                  {analysis.typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-0.5 mt-1">
            {analysis.typeData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate flex-1">{d.name}</span>
                <span className="text-muted-foreground">{d.share.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Location distribution */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Standorte
          </p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analysis.locationData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={25}>
                  {analysis.locationData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-0.5 mt-1">
            {analysis.locationData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[(i + 2) % COLORS.length] }} />
                <span className="truncate flex-1">{d.name}</span>
                <span className="text-muted-foreground">{d.share.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiversifikationsScore;
