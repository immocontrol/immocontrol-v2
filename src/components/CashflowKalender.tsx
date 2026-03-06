/**
 * IMP20-8: Cashflow-Kalender
 * Calendar view showing: rent inflows, credit rate outflows, utility advance payments.
 * Visual per day/week with color coding.
 */
import { memo, useState, useMemo } from "react";
import { Calendar, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";

interface CashflowDay {
  date: number;
  inflows: number;
  outflows: number;
  items: Array<{ label: string; amount: number; type: "in" | "out" }>;
}

const CashflowKalender = memo(() => {
  const { properties, stats } = useProperties();
  const [monthOffset, setMonthOffset] = useState(0);

  const { year, month, days, totals } = useMemo(() => {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

    const days: (CashflowDay | null)[] = [];

    // Fill empty cells before first day
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);

    let totalIn = 0;
    let totalOut = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const items: CashflowDay["items"] = [];

      // Rent typically comes on 1st-3rd of month
      if (d <= 3 && properties.length > 0) {
        const rentPerDay = stats.totalRent / 3;
        items.push({ label: "Mieteinnahmen", amount: rentPerDay, type: "in" });
      }

      // Credit rates typically due on 1st or 15th
      if ((d === 1 || d === 15) && stats.totalCreditRate > 0) {
        const creditPerPayment = stats.totalCreditRate / 2;
        items.push({ label: "Kreditrate", amount: creditPerPayment, type: "out" });
      }

      // Nebenkosten typically on 1st
      if (d === 1 && stats.totalExpenses > 0) {
        items.push({ label: "Nebenkosten-VZ", amount: stats.totalExpenses, type: "out" });
      }

      const inflows = items.filter(i => i.type === "in").reduce((s, i) => s + i.amount, 0);
      const outflows = items.filter(i => i.type === "out").reduce((s, i) => s + i.amount, 0);
      totalIn += inflows;
      totalOut += outflows;

      days.push({ date: d, inflows, outflows, items });
    }

    return { year, month, days, totals: { totalIn, totalOut, net: totalIn - totalOut } };
  }, [properties, stats, monthOffset]);

  const monthName = new Date(year, month).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Cashflow-Kalender</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMonthOffset(p => p - 1)} aria-label="Vorheriger Monat">
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-xs font-medium min-w-[120px] text-center">{monthName}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMonthOffset(p => p + 1)} aria-label="Nächster Monat">
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-1.5 rounded-lg bg-profit/10">
          <p className="text-[9px] text-muted-foreground">Einnahmen</p>
          <p className="text-[10px] font-bold text-profit">{formatCurrency(totals.totalIn)}</p>
        </div>
        <div className="text-center p-1.5 rounded-lg bg-loss/10">
          <p className="text-[9px] text-muted-foreground">Ausgaben</p>
          <p className="text-[10px] font-bold text-loss">{formatCurrency(totals.totalOut)}</p>
        </div>
        <div className="text-center p-1.5 rounded-lg bg-primary/10">
          <p className="text-[9px] text-muted-foreground">Netto</p>
          <p className={`text-[10px] font-bold ${totals.net >= 0 ? "text-profit" : "text-loss"}`}>
            {formatCurrency(totals.net)}
          </p>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {weekDays.map(d => (
          <div key={d} className="text-center text-[9px] text-muted-foreground font-medium py-1">{d}</div>
        ))}
        {days.map((day, i) => (
          <div
            key={i}
            className={`text-center p-1 rounded text-[9px] min-h-[28px] ${
              day === null ? "" :
              day.inflows > 0 && day.outflows > 0 ? "bg-primary/10" :
              day.inflows > 0 ? "bg-profit/10" :
              day.outflows > 0 ? "bg-loss/10" :
              "bg-background/50"
            }`}
          >
            {day && (
              <>
                <span className="font-medium">{day.date}</span>
                {day.inflows > 0 && (
                  <div className="flex items-center justify-center gap-0.5 text-profit">
                    <ArrowUpRight className="h-2 w-2" />
                  </div>
                )}
                {day.outflows > 0 && (
                  <div className="flex items-center justify-center gap-0.5 text-loss">
                    <ArrowDownRight className="h-2 w-2" />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
CashflowKalender.displayName = "CashflowKalender";

export { CashflowKalender };
