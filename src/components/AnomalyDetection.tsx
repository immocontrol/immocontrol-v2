/**
 * #14: Dashboard Anomaly Detection
 * Automatically detects unusual patterns in portfolio data and shows warnings.
 */
import { useMemo } from "react";
import { AlertTriangle, TrendingDown, Users, Landmark, Percent } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";

interface Anomaly {
  id: string;
  severity: "warning" | "critical";
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function AnomalyDetection() {
  const { properties, stats } = useProperties();

  const anomalies = useMemo<Anomaly[]>(() => {
    if (properties.length === 0) return [];
    const result: Anomaly[] = [];

    // 1. Negative cashflow properties
    const negativeCF = properties.filter(p => p.monthlyCashflow < 0);
    if (negativeCF.length > 0) {
      const totalLoss = negativeCF.reduce((s, p) => s + Math.abs(p.monthlyCashflow), 0);
      result.push({
        id: "negative-cf",
        severity: negativeCF.length > 1 ? "critical" : "warning",
        icon: <TrendingDown className="h-4 w-4" />,
        title: `${negativeCF.length} Objekt${negativeCF.length > 1 ? "e" : ""} mit negativem Cashflow`,
        description: `${negativeCF.map(p => p.name).join(", ")} — ${formatCurrency(totalLoss)}/M Verlust`,
      });
    }

    // 2. High LTV ratio (> 80%)
    if (stats.totalValue > 0) {
      const ltv = (stats.totalDebt / stats.totalValue) * 100;
      if (ltv > 80) {
        result.push({
          id: "high-ltv",
          severity: ltv > 90 ? "critical" : "warning",
          icon: <Landmark className="h-4 w-4" />,
          title: `Hohe Verschuldungsquote: ${ltv.toFixed(0)}%`,
          description: "LTV über 80% — Refinanzierungsrisiko bei Zinsanstieg beachten",
        });
      }
    }

    // 3. Properties with rent below market average (>30% below portfolio average)
    if (properties.length >= 3) {
      const avgRentPerSqm = stats.totalSqm > 0 ? stats.totalRent / stats.totalSqm : 0;
      const underPerformers = properties.filter(p => {
        if (!p.sqm || p.sqm === 0) return false;
        const rentPerSqm = p.monthlyRent / p.sqm;
        return rentPerSqm < avgRentPerSqm * 0.7;
      });
      if (underPerformers.length > 0) {
        result.push({
          id: "low-rent",
          severity: "warning",
          icon: <Percent className="h-4 w-4" />,
          title: `${underPerformers.length} Objekt${underPerformers.length > 1 ? "e" : ""} unter Durchschnittsmiete`,
          description: `${underPerformers.map(p => p.name).join(", ")} — Mietanpassung prüfen`,
        });
      }
    }

    // 4. High expense ratio (expenses > 50% of rent)
    const highExpense = properties.filter(p => {
      if (p.monthlyRent <= 0) return false;
      const ratio = (p.monthlyExpenses + p.monthlyCreditRate) / p.monthlyRent;
      return ratio > 0.9;
    });
    if (highExpense.length > 0) {
      result.push({
        id: "high-expense",
        severity: highExpense.some(p => (p.monthlyExpenses + p.monthlyCreditRate) > p.monthlyRent) ? "critical" : "warning",
        icon: <AlertTriangle className="h-4 w-4" />,
        title: `${highExpense.length} Objekt${highExpense.length > 1 ? "e" : ""} mit hoher Kostenquote`,
        description: `Kosten übersteigen 90% der Mieteinnahmen — Optimierungspotenzial prüfen`,
      });
    }

    // 5. Properties with no tenants (vacant units)
    const emptyProperties = properties.filter(p => p.monthlyRent === 0 && p.units > 0);
    if (emptyProperties.length > 0) {
      result.push({
        id: "vacant",
        severity: "warning",
        icon: <Users className="h-4 w-4" />,
        title: `${emptyProperties.length} Objekt${emptyProperties.length > 1 ? "e" : ""} ohne Mieteinnahmen`,
        description: `${emptyProperties.map(p => p.name).join(", ")} — Leerstand oder fehlende Daten`,
      });
    }

    return result;
  }, [properties, stats]);

  if (anomalies.length === 0) return null;

  return (
    <div className="space-y-2">
      {anomalies.map(a => (
        <div
          key={a.id}
          className={`rounded-xl border p-3 flex items-start gap-3 animate-fade-in ${
            a.severity === "critical"
              ? "border-loss/30 bg-loss/5"
              : "border-gold/30 bg-gold/5"
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            a.severity === "critical" ? "bg-loss/10 text-loss" : "bg-gold/10 text-gold"
          }`}>
            {a.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{a.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AnomalyDetection;
