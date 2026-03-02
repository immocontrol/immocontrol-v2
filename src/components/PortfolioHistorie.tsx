import { useState, useMemo, useCallback, useEffect } from "react";
import { History, TrendingUp, TrendingDown, Building2, Plus, Trash2, Download, Target, Calendar, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart, Legend } from "recharts";

/* HIST-1: Portfolio Historie — Soll/Ist-Vergleich für Vermögensentwicklung */

/** Event types that are wealth-relevant */
type HistoryEventType =
  | "property_purchase"    // Neues Objekt gekauft
  | "property_sale"        // Objekt verkauft
  | "rent_increase"        // Mieterhöhung
  | "rent_decrease"        // Mietminderung
  | "renovation"           // Renovierung/Sanierung
  | "loan_repayment"       // Sondertilgung
  | "value_change"         // Wertänderung (Markt)
  | "expense_change"       // Kostenänderung
  | "tenant_change"        // Mieterwechsel
  | "vacancy_start"        // Leerstand beginn
  | "vacancy_end"          // Leerstand Ende
  | "refinancing"          // Umfinanzierung
  | "tax_payment"          // Steuerzahlung
  | "insurance_change"     // Versicherungsänderung
  | "manual_snapshot";     // Manueller Eintrag

interface HistoryEvent {
  id: string;
  date: string;           // ISO date
  type: HistoryEventType;
  description: string;
  propertyId?: string;     // Optional: linked property
  valueBefore: number;     // Portfolio net worth before
  valueAfter: number;      // Portfolio net worth after
  cashflowBefore: number;  // Monthly cashflow before
  cashflowAfter: number;   // Monthly cashflow after
  debtBefore: number;      // Total debt before
  debtAfter: number;       // Total debt after
  rentAfter?: number;      // Gross rent at time of event
  propertyCount?: number;  // Number of properties at time of event
  isAutomatic: boolean;    // Auto-captured vs manual
}

/** Plan/target data point */
interface PlanDataPoint {
  date: string;          // ISO date
  targetNetWorth: number;
  targetCashflow: number;
  note?: string;
}

/** Merged chart data for Soll/Ist comparison */
interface ChartDataPoint {
  date: string;
  label: string;
  istNetWorth: number;
  sollNetWorth: number | null;
  istCashflow: number;
  sollCashflow: number | null;
  eventType?: HistoryEventType;
  description?: string;
}

const STORAGE_KEY = "immo-portfolio-history";
const PLAN_STORAGE_KEY = "immo-portfolio-plan";

const EVENT_LABELS: Record<HistoryEventType, string> = {
  property_purchase: "Objektkauf",
  property_sale: "Objektverkauf",
  rent_increase: "Mieterhöhung",
  rent_decrease: "Mietminderung",
  renovation: "Renovierung",
  loan_repayment: "Sondertilgung",
  value_change: "Wertänderung",
  expense_change: "Kostenänderung",
  tenant_change: "Mieterwechsel",
  vacancy_start: "Leerstand",
  vacancy_end: "Neuvermietung",
  refinancing: "Umfinanzierung",
  tax_payment: "Steuerzahlung",
  insurance_change: "Versicherung",
  manual_snapshot: "Manuell",
};

const EVENT_COLORS: Record<HistoryEventType, string> = {
  property_purchase: "bg-primary/10 text-primary",
  property_sale: "bg-gold/10 text-gold",
  rent_increase: "bg-profit/10 text-profit",
  rent_decrease: "bg-loss/10 text-loss",
  renovation: "bg-secondary text-foreground",
  loan_repayment: "bg-primary/10 text-primary",
  value_change: "bg-gold/10 text-gold",
  expense_change: "bg-loss/10 text-loss",
  tenant_change: "bg-secondary text-foreground",
  vacancy_start: "bg-loss/10 text-loss",
  vacancy_end: "bg-profit/10 text-profit",
  refinancing: "bg-primary/10 text-primary",
  tax_payment: "bg-loss/10 text-loss",
  insurance_change: "bg-secondary text-foreground",
  manual_snapshot: "bg-muted text-muted-foreground",
};

function generateId(): string {
  return `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** HIST-2: Auto-detect changes by comparing current portfolio state with last snapshot */
function detectChanges(
  currentStats: { totalValue: number; totalCashflow: number; totalDebt: number; totalRent: number; propertyCount: number },
  lastSnapshot: { netWorth: number; cashflow: number; debt: number; rent: number; propertyCount: number } | null,
): { type: HistoryEventType; description: string } | null {
  if (!lastSnapshot) return null;

  const currentNetWorth = currentStats.totalValue - currentStats.totalDebt;
  const diff = currentNetWorth - lastSnapshot.netWorth;
  const threshold = Math.max(1000, Math.abs(lastSnapshot.netWorth) * 0.01); // 1% or 1000€ minimum

  // Detect property count change first (independent of net worth threshold)
  if (currentStats.propertyCount > lastSnapshot.propertyCount) {
    return { type: "property_purchase", description: `Neues Objekt hinzugefügt (${currentStats.propertyCount} gesamt)` };
  }
  if (currentStats.propertyCount < lastSnapshot.propertyCount) {
    return { type: "property_sale", description: `Objekt entfernt (${currentStats.propertyCount} gesamt)` };
  }

  if (Math.abs(diff) < threshold) return null;

  // Detect rent change
  const rentDiff = currentStats.totalRent - lastSnapshot.rent;
  if (Math.abs(rentDiff) > 50) {
    return rentDiff > 0
      ? { type: "rent_increase", description: `Mieteinnahmen +${formatCurrency(rentDiff)}/M` }
      : { type: "rent_decrease", description: `Mieteinnahmen ${formatCurrency(rentDiff)}/M` };
  }

  // Detect debt change (repayment)
  const debtDiff = currentStats.totalDebt - lastSnapshot.debt;
  if (debtDiff < -5000) {
    return { type: "loan_repayment", description: `Schuldenabbau ${formatCurrency(Math.abs(debtDiff))}` };
  }

  // General value change
  return {
    type: "value_change",
    description: `Vermögensänderung ${diff > 0 ? "+" : ""}${formatCurrency(diff)}`,
  };
}

/** HIST-3: Custom tooltip for the chart */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-xs min-w-[180px]">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function PortfolioHistorie() {
  const { user } = useAuth();
  const { properties, stats } = useProperties();

  /* HIST-4: Persist history events in localStorage */
  const [events, setEvents] = useState<HistoryEvent[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [planPoints, setPlanPoints] = useState<PlanDataPoint[]>(() => {
    try {
      const stored = localStorage.getItem(PLAN_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch { /* */ }
  }, [events]);

  useEffect(() => {
    try { localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planPoints)); } catch { /* */ }
  }, [planPoints]);

  /* HIST-5: Auto-detect portfolio changes and add events */
  const lastSnapshotRef = useMemo(() => {
    if (events.length === 0) return null;
    const last = events[events.length - 1];
    return {
      netWorth: last.valueAfter,
      cashflow: last.cashflowAfter,
      debt: last.debtAfter,
      rent: last.rentAfter ?? last.cashflowAfter, // use stored rent, fallback to cashflow for old events
      propertyCount: last.propertyCount ?? properties.length, // use stored count, fallback for old events
    };
  }, [events, properties.length]);

  useEffect(() => {
    if (!user || properties.length === 0) return;

    const currentNetWorth = stats.totalValue - stats.totalDebt;
    const currentCashflow = stats.totalCashflow;

    // Auto-snapshot: if no events yet, create initial snapshot
    if (events.length === 0) {
      const initial: HistoryEvent = {
        id: generateId(),
        date: new Date().toISOString().split("T")[0],
        type: "manual_snapshot",
        description: "Initiale Portfolioaufnahme",
        valueBefore: currentNetWorth,
        valueAfter: currentNetWorth,
        cashflowBefore: currentCashflow,
        cashflowAfter: currentCashflow,
        debtBefore: stats.totalDebt,
        debtAfter: stats.totalDebt,
        rentAfter: stats.totalRent,
        propertyCount: properties.length,
        isAutomatic: true,
      };
      setEvents([initial]);
      return;
    }

    // Check for changes every time properties/stats update
    const change = detectChanges(
      { totalValue: stats.totalValue, totalCashflow: currentCashflow, totalDebt: stats.totalDebt, totalRent: stats.totalRent, propertyCount: properties.length },
      lastSnapshotRef,
    );

    if (change) {
      const lastEvent = events[events.length - 1];
      // Debounce: don't add if same type within last 24h (date stored as YYYY-MM-DD only)
      const lastDate = new Date(lastEvent.date + 'T00:00:00').getTime();
      const now = Date.now();
      if (now - lastDate < 86400000 && lastEvent.type === change.type) return;

      const newEvent: HistoryEvent = {
        id: generateId(),
        date: new Date().toISOString().split("T")[0],
        type: change.type,
        description: change.description,
        valueBefore: lastEvent.valueAfter,
        valueAfter: currentNetWorth,
        cashflowBefore: lastEvent.cashflowAfter,
        cashflowAfter: currentCashflow,
        debtBefore: lastEvent.debtAfter,
        debtAfter: stats.totalDebt,
        rentAfter: stats.totalRent,
        propertyCount: properties.length,
        isAutomatic: true,
      };
      setEvents(prev => [...prev, newEvent]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.totalValue, stats.totalDebt, stats.totalCashflow, properties.length]);

  /* HIST-6: Dialog state for adding manual events */
  const [addOpen, setAddOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "manual_snapshot" as HistoryEventType,
    description: "",
    netWorth: 0,
    cashflow: 0,
    debt: 0,
  });
  const [newPlan, setNewPlan] = useState({
    date: "",
    targetNetWorth: 0,
    targetCashflow: 0,
    note: "",
  });

  const addManualEvent = useCallback(() => {
    const lastEvent = events[events.length - 1];
    const event: HistoryEvent = {
      id: generateId(),
      date: newEvent.date,
      type: newEvent.type,
      description: newEvent.description || EVENT_LABELS[newEvent.type],
      valueBefore: lastEvent?.valueAfter ?? 0,
      valueAfter: newEvent.netWorth,
      cashflowBefore: lastEvent?.cashflowAfter ?? 0,
      cashflowAfter: newEvent.cashflow,
      debtBefore: lastEvent?.debtAfter ?? 0,
      debtAfter: newEvent.debt,
      rentAfter: stats.totalRent,
      propertyCount: properties.length,
      isAutomatic: false,
    };
    setEvents(prev => [...prev, event].sort((a, b) => a.date.localeCompare(b.date)));
    setAddOpen(false);
    toast.success("Ereignis hinzugefügt");
  }, [events, newEvent, stats.totalRent, properties.length]);

  const addPlanPoint = useCallback(() => {
    const point: PlanDataPoint = {
      date: newPlan.date,
      targetNetWorth: newPlan.targetNetWorth,
      targetCashflow: newPlan.targetCashflow,
      note: newPlan.note || undefined,
    };
    setPlanPoints(prev => [...prev, point].sort((a, b) => a.date.localeCompare(b.date)));
    setPlanOpen(false);
    toast.success("Planwert hinzugefügt");
  }, [newPlan]);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    toast.success("Ereignis gelöscht");
  }, []);

  /* HIST-7: Build chart data — merge Ist (events) with Soll (plan) */
  const chartData = useMemo<ChartDataPoint[]>(() => {
    const allDates = new Set<string>();
    events.forEach(e => allDates.add(e.date));
    planPoints.forEach(p => allDates.add(p.date));

    const sortedDates = Array.from(allDates).sort();

    return sortedDates.map(date => {
      const event = events.filter(e => e.date <= date).pop();
      const plan = planPoints.filter(p => p.date <= date).pop();

      return {
        date,
        label: new Date(date).toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
        istNetWorth: event?.valueAfter ?? 0,
        sollNetWorth: plan?.targetNetWorth ?? null,
        istCashflow: event?.cashflowAfter ?? 0,
        sollCashflow: plan?.targetCashflow ?? null,
        eventType: events.find(e => e.date === date)?.type,
        description: events.find(e => e.date === date)?.description,
      };
    });
  }, [events, planPoints]);

  /* HIST-8: Summary stats */
  const currentNetWorth = stats.totalValue - stats.totalDebt;
  const firstEvent = events[0];
  const totalChange = firstEvent ? currentNetWorth - firstEvent.valueAfter : 0;
  const totalChangePercent = firstEvent && firstEvent.valueAfter !== 0
    ? (totalChange / Math.abs(firstEvent.valueAfter)) * 100
    : 0;

  const latestPlan = planPoints.length > 0 ? planPoints[planPoints.length - 1] : null;
  const planDeviation = latestPlan ? currentNetWorth - latestPlan.targetNetWorth : null;
  const planDeviationPercent = latestPlan && latestPlan.targetNetWorth !== 0
    ? ((planDeviation ?? 0) / latestPlan.targetNetWorth) * 100
    : null;

  /* HIST-9: CSV Export */
  const exportCSV = useCallback(() => {
    const headers = ["Datum", "Typ", "Beschreibung", "Nettovermögen vorher", "Nettovermögen nachher", "Cashflow vorher", "Cashflow nachher", "Schulden vorher", "Schulden nachher", "Automatisch"];
    const rows = events.map(e => [
      e.date, EVENT_LABELS[e.type], e.description, e.valueBefore, e.valueAfter,
      e.cashflowBefore, e.cashflowAfter, e.debtBefore, e.debtAfter, e.isAutomatic ? "Ja" : "Nein",
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio_historie_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Historie als CSV exportiert");
  }, [events]);

  const [view, setView] = useState<"chart" | "timeline">("chart");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Portfolio Historie
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Soll/Ist-Vergleich · {events.length} Ereignisse erfasst
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          {["chart", "timeline"].map(v => (
            <button
              key={v}
              onClick={() => setView(v as "chart" | "timeline")}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                view === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {v === "chart" ? "Chart" : "Timeline"}
            </button>
          ))}

          {/* Add manual event */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Ereignis
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Vermögensereignis erfassen</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Datum</Label>
                    <Input type="date" value={newEvent.date} onChange={e => setNewEvent(prev => ({ ...prev, date: e.target.value }))} className="text-xs h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Typ</Label>
                    <Select value={newEvent.type} onValueChange={v => setNewEvent(prev => ({ ...prev, type: v as HistoryEventType }))}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Beschreibung</Label>
                  <Input value={newEvent.description} onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))} placeholder="z.B. MFH Berlin gekauft" className="text-xs h-9" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Nettovermögen</Label>
                    <Input type="number" value={newEvent.netWorth || ""} onChange={e => setNewEvent(prev => ({ ...prev, netWorth: Number(e.target.value) }))} className="text-xs h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Cashflow/M</Label>
                    <Input type="number" value={newEvent.cashflow || ""} onChange={e => setNewEvent(prev => ({ ...prev, cashflow: Number(e.target.value) }))} className="text-xs h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Schulden</Label>
                    <Input type="number" value={newEvent.debt || ""} onChange={e => setNewEvent(prev => ({ ...prev, debt: Number(e.target.value) }))} className="text-xs h-9" />
                  </div>
                </div>
                <Button onClick={addManualEvent} className="w-full gap-1.5" size="sm">
                  <Plus className="h-3.5 w-3.5" /> Ereignis speichern
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add plan target */}
          <Dialog open={planOpen} onOpenChange={setPlanOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Target className="h-3.5 w-3.5" /> Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Planwert / Ziel setzen</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Zieldatum</Label>
                  <Input type="date" value={newPlan.date} onChange={e => setNewPlan(prev => ({ ...prev, date: e.target.value }))} className="text-xs h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Ziel-Nettovermögen</Label>
                    <Input type="number" value={newPlan.targetNetWorth || ""} onChange={e => setNewPlan(prev => ({ ...prev, targetNetWorth: Number(e.target.value) }))} className="text-xs h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Ziel-Cashflow/M</Label>
                    <Input type="number" value={newPlan.targetCashflow || ""} onChange={e => setNewPlan(prev => ({ ...prev, targetCashflow: Number(e.target.value) }))} className="text-xs h-9" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notiz</Label>
                  <Input value={newPlan.note} onChange={e => setNewPlan(prev => ({ ...prev, note: e.target.value }))} placeholder="z.B. 5-Jahres-Ziel" className="text-xs h-9" />
                </div>
                <Button onClick={addPlanPoint} className="w-full gap-1.5" size="sm">
                  <Target className="h-3.5 w-3.5" /> Planwert speichern
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {events.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          )}
        </div>
      </div>

      {/* HIST-10: KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 card-stagger-enter">
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Aktuelles Nettovermögen</p>
          <p className="text-lg font-bold mt-1 currency-display">{formatCurrency(currentNetWorth)}</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Veränderung gesamt</p>
          <p className={`text-lg font-bold mt-1 flex items-center gap-1 ${totalChange >= 0 ? "text-profit" : "text-loss"}`}>
            {totalChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {formatCurrency(Math.abs(totalChange))}
          </p>
          <p className="text-[10px] text-muted-foreground">{totalChangePercent >= 0 ? "+" : ""}{totalChangePercent.toFixed(1)}%</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Plan-Abweichung</p>
          {planDeviation !== null ? (
            <>
              <p className={`text-lg font-bold mt-1 flex items-center gap-1 ${planDeviation >= 0 ? "text-profit" : "text-loss"}`}>
                {planDeviation >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {formatCurrency(Math.abs(planDeviation))}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {planDeviationPercent !== null && `${planDeviationPercent >= 0 ? "+" : ""}${planDeviationPercent.toFixed(1)}% vs. Plan`}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Kein Plan definiert</p>
          )}
        </div>
        <div className="gradient-card rounded-xl border border-border p-4 card-accent-shadow">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ereignisse</p>
          <p className="text-lg font-bold mt-1">{events.length}</p>
          <p className="text-[10px] text-muted-foreground">
            {events.filter(e => e.isAutomatic).length} auto · {events.filter(e => !e.isAutomatic).length} manuell
          </p>
        </div>
      </div>

      {/* HIST-11: Chart View — Soll/Ist Comparison */}
      {view === "chart" && chartData.length > 1 && (
        <div className="gradient-card rounded-xl border border-border p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" /> Vermögensentwicklung — Soll vs. Ist
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="istGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <RTooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => <span className="text-xs">{value}</span>}
              />
              <Area
                type="monotone"
                dataKey="istNetWorth"
                name="Ist-Nettovermögen"
                fill="url(#istGradient)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              {chartData.some(d => d.sollNetWorth !== null) && (
                <Line
                  type="monotone"
                  dataKey="sollNetWorth"
                  name="Soll-Nettovermögen"
                  stroke="hsl(var(--gold))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* HIST-12: Timeline View */}
      {view === "timeline" && (
        <div className="space-y-2">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 empty-state-float">
                <History className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2">Noch keine Historie</h3>
              <p className="text-sm text-muted-foreground">Ereignisse werden automatisch erfasst oder können manuell hinzugefügt werden.</p>
            </div>
          ) : (
            [...events].reverse().map((event) => {
              const change = event.valueAfter - event.valueBefore;
              return (
                <div key={event.id} className="gradient-card rounded-xl border border-border p-3 sm:p-4 flex items-start gap-3 group property-card-hover">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {change > 0 ? <TrendingUp className="h-4 w-4 text-profit" /> :
                     change < 0 ? <TrendingDown className="h-4 w-4 text-loss" /> :
                     <Minus className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{event.description}</span>
                      <Badge variant="secondary" className={`text-[10px] h-4 ${EVENT_COLORS[event.type]}`}>
                        {EVENT_LABELS[event.type]}
                      </Badge>
                      {event.isAutomatic && (
                        <Badge variant="outline" className="text-[9px] h-3.5">Auto</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(event.date)}
                      </span>
                      <span>
                        Vermögen: {formatCurrency(event.valueBefore)} → {formatCurrency(event.valueAfter)}
                      </span>
                      {change !== 0 && (
                        <span className={change > 0 ? "text-profit" : "text-loss"}>
                          {change > 0 ? "+" : ""}{formatCurrency(change)}
                        </span>
                      )}
                    </div>
                  </div>
                  {!event.isAutomatic && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-loss"
                          onClick={() => deleteEvent(event.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Löschen</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
