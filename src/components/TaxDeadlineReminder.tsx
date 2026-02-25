import { useMemo } from "react";
import { Calendar, AlertTriangle, CheckCircle } from "lucide-react";

const TaxDeadlineReminder = () => {
  const deadlines = useMemo(() => {
    const year = new Date().getFullYear();
    const now = new Date();
    const items = [
      { label: "Grundsteuer Q1", date: new Date(year, 1, 15), desc: "Grundsteuer 1. Quartal" },
      { label: "Umsatzsteuer-VA März", date: new Date(year, 3, 10), desc: "USt-Voranmeldung" },
      { label: "Grundsteuer Q2", date: new Date(year, 4, 15), desc: "Grundsteuer 2. Quartal" },
      { label: "Einkommensteuererklärung", date: new Date(year, 6, 31), desc: `EStE ${year - 1} (ohne Berater)` },
      { label: "Grundsteuer Q3", date: new Date(year, 7, 15), desc: "Grundsteuer 3. Quartal" },
      { label: "Grundsteuer Q4", date: new Date(year, 10, 15), desc: "Grundsteuer 4. Quartal" },
      { label: "EStE mit Berater", date: new Date(year + 1, 1, 28), desc: `EStE ${year} (mit Berater)` },
    ];
    return items.map(d => ({
      ...d,
      isPast: d.date < now,
      daysLeft: Math.ceil((d.date.getTime() - now.getTime()) / 86400000),
    })).filter(d => d.daysLeft > -30); // Show recent past too
  }, []);

  const upcoming = deadlines.filter(d => !d.isPast && d.daysLeft <= 60);

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-muted-foreground" /> Steuertermine
        {upcoming.length > 0 && (
          <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-bold">{upcoming.length} bald</span>
        )}
      </h3>
      <div className="space-y-1.5">
        {deadlines.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-secondary/30">
            <div className="flex items-center gap-2">
              {d.isPast ? (
                <CheckCircle className="h-3 w-3 text-profit shrink-0" />
              ) : d.daysLeft <= 14 ? (
                <AlertTriangle className="h-3 w-3 text-loss shrink-0" />
              ) : d.daysLeft <= 30 ? (
                <AlertTriangle className="h-3 w-3 text-gold shrink-0" />
              ) : (
                <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className={d.isPast ? "line-through text-muted-foreground" : "font-medium"}>{d.label}</span>
            </div>
            <span className={`text-[10px] ${d.isPast ? "text-muted-foreground" : d.daysLeft <= 14 ? "text-loss font-bold" : "text-muted-foreground"}`}>
              {d.isPast ? "Erledigt" : d.daysLeft === 0 ? "Heute!" : d.daysLeft === 1 ? "Morgen" : `in ${d.daysLeft}T`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaxDeadlineReminder;