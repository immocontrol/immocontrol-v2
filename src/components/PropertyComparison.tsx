import { useState, useMemo } from "react";
import { BarChart3, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { useProperties } from "@/context/PropertyContext";

export function PropertyComparison() {
  const { properties } = useProperties();
  const [propA, setPropA] = useState("");
  const [propB, setPropB] = useState("");

  const a = properties.find(p => p.id === propA);
  const b = properties.find(p => p.id === propB);

  const metrics = useMemo(() => {
    if (!a || !b) return [];
    return [
      { label: "Kaufpreis", a: a.purchasePrice, b: b.purchasePrice, format: formatCurrency },
      { label: "Aktueller Wert", a: a.currentValue, b: b.currentValue, format: formatCurrency },
      { label: "Kaltmiete/M", a: a.monthlyRent, b: b.monthlyRent, format: formatCurrency },
      { label: "Cashflow/M", a: a.monthlyCashflow, b: b.monthlyCashflow, format: formatCurrency },
      { label: "Brutto-Rendite", a: a.purchasePrice > 0 ? (a.monthlyRent * 12 / a.purchasePrice * 100) : 0, b: b.purchasePrice > 0 ? (b.monthlyRent * 12 / b.purchasePrice * 100) : 0, format: (v: number) => `${v.toFixed(2)}%` },
      { label: "Restschuld", a: a.remainingDebt, b: b.remainingDebt, format: formatCurrency },
      { label: "Einheiten", a: a.units, b: b.units, format: (v: number) => String(v) },
      { label: "Fläche m²", a: a.sqm, b: b.sqm, format: (v: number) => `${v} m²` },
      { label: "Miete/m²", a: a.sqm > 0 ? a.monthlyRent / a.sqm : 0, b: b.sqm > 0 ? b.monthlyRent / b.sqm : 0, format: (v: number) => `${v.toFixed(2)} €/m²` },
      { label: "Kosten/M", a: a.monthlyExpenses, b: b.monthlyExpenses, format: formatCurrency },
      { label: "Kreditrate/M", a: a.monthlyCreditRate, b: b.monthlyCreditRate, format: formatCurrency },
      { label: "Zinssatz", a: a.interestRate, b: b.interestRate, format: (v: number) => `${v}%` },
      { label: "Wertsteigerung", a: a.purchasePrice > 0 ? ((a.currentValue - a.purchasePrice) / a.purchasePrice * 100) : 0, b: b.purchasePrice > 0 ? ((b.currentValue - b.purchasePrice) / b.purchasePrice * 100) : 0, format: (v: number) => `${v.toFixed(1)}%` },
    ];
  }, [a, b]);

  if (properties.length < 2) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowLeftRight className="h-3.5 w-3.5" /> Vergleichen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Objektvergleich
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Select value={propA} onValueChange={setPropA}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Objekt A wählen" /></SelectTrigger>
            <SelectContent>
              {properties.filter(p => p.id !== propB).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={propB} onValueChange={setPropB}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Objekt B wählen" /></SelectTrigger>
            <SelectContent>
              {properties.filter(p => p.id !== propA).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {a && b ? (
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
              <span>Kennzahl</span>
              <span className="text-center">{a.name}</span>
              <span className="text-center">{b.name}</span>
            </div>
            {metrics.map(m => {
              const better = m.label === "Kosten/M" || m.label === "Kreditrate/M" || m.label === "Restschuld" || m.label === "Kaufpreis"
                ? (m.a < m.b ? "a" : m.a > m.b ? "b" : "none")
                : (m.a > m.b ? "a" : m.a < m.b ? "b" : "none");
              return (
                <div key={m.label} className="grid grid-cols-3 gap-2 py-1.5 text-xs hover:bg-secondary/30 rounded transition-colors">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className={`text-center font-medium tabular-nums ${better === "a" ? "text-profit font-bold" : ""}`}>
                    {m.format(m.a)} {better === "a" && "✓"}
                  </span>
                  <span className={`text-center font-medium tabular-nums ${better === "b" ? "text-profit font-bold" : ""}`}>
                    {m.format(m.b)} {better === "b" && "✓"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">Wähle zwei Objekte zum Vergleichen</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
