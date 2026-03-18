import { useEffect, useMemo, useState, useRef } from "react";
import { Target, Plus, Trash2, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { fireConfetti } from "@/lib/confetti";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/LoadingButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toastSuccess } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { fromTable } from "@/lib/typedSupabase";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const SMART_STEPS = [
  { key: "s", label: "Spezifisch", short: "S" },
  { key: "m", label: "Messbar", short: "M" },
  { key: "a", label: "Erreichbar", short: "A" },
  { key: "r", label: "Relevant", short: "R" },
  { key: "t", label: "Terminiert", short: "T" },
] as const;

interface Goal {
  id: string;
  title: string;
  type: "value" | "cashflow" | "units" | "equity" | "units_per_year";
  target: number;
  current_value: number;
  deadline: string | null;
  reason?: string | null;
}

interface PortfolioGoalsProps {
  currentStats: {
    totalValue: number;
    totalCashflow: number;
    totalUnits: number;
    equity: number;
  };
}

const GOAL_TYPES = [
  { value: "value", label: "Portfoliowert", unit: "€" },
  { value: "cashflow", label: "Monatlicher Cashflow", unit: "€/M" },
  { value: "units", label: "Einheiten gesamt", unit: "Einh." },
  { value: "units_per_year", label: "Einheiten pro Jahr kaufen", unit: "Einh./Jahr" },
  { value: "equity", label: "Eigenkapital", unit: "€" },
];

function unitsAcquiredLast12Months(properties: { units: number; purchaseDate: string }[]): number {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return properties
    .filter((p) => p.purchaseDate && p.purchaseDate >= cutoffStr)
    .reduce((sum, p) => sum + (p.units || 0), 0);
}

const INITIAL_FORM = {
  title: "",
  type: "value" as Goal["type"],
  target: 0,
  deadline: "",
  reason: "",
};

const PortfolioGoals = ({ currentStats }: PortfolioGoalsProps) => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const goalReachedToastRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const state = location.state as { openGoalDialog?: boolean; goalPresetType?: Goal["type"] } | undefined;
    if (state?.openGoalDialog) {
      setOpen(true);
      setStep(1);
      setForm((f) => ({ ...f, type: state.goalPresetType ?? f.type }));
      navigate(location.pathname, { replace: true, state: {} });
      requestAnimationFrame(() => {
        document.getElementById("portfolio-goals-widget")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [location.state, location.pathname, navigate]);

  const unitsPerYearCurrent = useMemo(
    () => unitsAcquiredLast12Months(properties),
    [properties],
  );

  const { data: goals = [] } = useQuery({
    queryKey: ["portfolio_goals"],
    queryFn: async () => {
      const { data } = await fromTable("portfolio_goals").select("*").order("created_at");
      return (data || []) as unknown as Goal[];
    },
    enabled: !!user,
  });

  const getCurrent = (type: Goal["type"]) => {
    switch (type) {
      case "value": return currentStats.totalValue;
      case "cashflow": return currentStats.totalCashflow;
      case "units": return currentStats.totalUnits;
      case "units_per_year": return unitsPerYearCurrent;
      case "equity": return currentStats.equity;
    }
  };

  const doneGoalIds = useMemo(() => {
    return goals
      .filter((g) => {
        const current = getCurrent(g.type);
        return g.target > 0 && current >= g.target;
      })
      .map((g) => g.id);
  }, [goals, currentStats.totalValue, currentStats.totalCashflow, currentStats.totalUnits, currentStats.equity, unitsPerYearCurrent]);

  useEffect(() => {
    for (const id of doneGoalIds) {
      if (goalReachedToastRef.current.has(id)) continue;
      goalReachedToastRef.current.add(id);
      const g = goals.find((x) => x.id === id);
      if (g) {
        fireConfetti();
        toast.success("Ziel erreicht!", {
          description: g.title,
          duration: 5000,
        });
      }
    }
  }, [doneGoalIds, goals]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.title.trim() || form.target <= 0) throw new Error("Ungültig");
      const currentValue =
        form.type === "value" ? currentStats.totalValue
        : form.type === "cashflow" ? currentStats.totalCashflow
        : form.type === "units" ? currentStats.totalUnits
        : form.type === "units_per_year" ? unitsPerYearCurrent
        : currentStats.equity;
      const { error } = await fromTable("portfolio_goals").insert({
        user_id: user.id,
        title: form.title.trim(),
        type: form.type,
        target: form.target,
        current_value: currentValue,
        deadline: form.deadline || null,
        reason: form.reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toastSuccess("Ziel gesetzt (SMART)");
      setForm(INITIAL_FORM);
      setStep(1);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["portfolio_goals"] });
    },
    onError: (err) => handleError(err, { context: "supabase", toastMessage: "Fehler beim Speichern" }),
  });

  const selectedTypeConfig = GOAL_TYPES.find((t) => t.value === form.type);
  const currentValueForType = getCurrent(form.type);
  const canProceedStep1 = form.title.trim().length > 0 && form.type;
  const canProceedStep2 = form.target > 0;
  const canSubmit = form.deadline.length > 0;
  const formatCurrent = (val: number) =>
    form.type === "units" || form.type === "units_per_year"
      ? `${Math.round(val)}`
      : formatCurrency(val);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fromTable("portfolio_goals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio_goals"] }),
  });

  const daysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  };

  return (
    <div id="portfolio-goals-widget" className="gradient-card rounded-xl border border-border p-5 scroll-mt-24">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" /> Portfolio-Ziele
        </h3>
        <Dialog
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (isOpen) {
              setStep(1);
              setForm(INITIAL_FORM);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" /> Ziel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Neues Ziel (SMART)
              </DialogTitle>
            </DialogHeader>

            {/* Step indicator */}
            <div className="flex justify-between gap-1">
              {SMART_STEPS.map((s, i) => (
                <div
                  key={s.key}
                  className={cn(
                    "flex-1 rounded py-1 text-center text-[10px] font-medium",
                    i + 1 === step ? "bg-primary text-primary-foreground" : i + 1 < step ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground",
                  )}
                  title={s.label}
                >
                  {s.short}
                </div>
              ))}
            </div>

            <div className="min-h-[140px] space-y-4">
              {/* Step 1: Spezifisch */}
              {step === 1 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">S – Spezifisch: Was genau möchtest du erreichen?</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Kategorie</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as Goal["type"] }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GOAL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Label className="text-xs">Kurze Bezeichnung *</Label>
                    <Input
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="h-9 text-sm"
                      placeholder="z.B. 2.000 € monatlicher Cashflow"
                    />
                  </div>
                </>
              )}

              {/* Step 2: Messbar */}
              {step === 2 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">M – Messbar: Welcher konkrete Zielwert?</p>
                  {form.type === "units_per_year" && (
                    <p className="text-[11px] text-muted-foreground">Gezählt: Einheiten aus Objekten mit Kaufdatum in den letzten 12 Monaten.</p>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Zielwert * {selectedTypeConfig?.unit && `(${selectedTypeConfig.unit})`}</Label>
                    <NumberInput value={form.target} onChange={v => setForm(f => ({ ...f, target: v }))} className="h-9 text-sm" placeholder="0" />
                  </div>
                </>
              )}

              {/* Step 3: Erreichbar */}
              {step === 3 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">A – Erreichbar: Ist das Ziel für dich realistisch?</p>
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="text-muted-foreground">Aktueller Stand: <span className="font-semibold text-foreground">{formatCurrent(currentValueForType)} {selectedTypeConfig?.unit ?? ""}</span></p>
                    <p className="text-muted-foreground mt-1">Ziel: <span className="font-semibold text-foreground">{form.type === "units" || form.type === "units_per_year" ? form.target : formatCurrency(form.target)} {selectedTypeConfig?.unit ?? ""}</span></p>
                  </div>
                </>
              )}

              {/* Step 4: Relevant */}
              {step === 4 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">R – Relevant: Warum ist dir dieses Ziel wichtig?</p>
                  <textarea
                    value={form.reason}
                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                    placeholder="z.B. Für finanzielle Freiheit / Sicherheit für die Familie …"
                  />
                </>
              )}

              {/* Step 5: Terminiert */}
              {step === 5 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">T – Terminiert: Bis wann möchtest du es erreichen?</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Deadline *</Label>
                    <input
                      type="date"
                      value={form.deadline}
                      onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                      className="h-9 text-sm w-full rounded-md border border-input bg-background px-3 py-1"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between gap-2 pt-2">
              {step > 1 ? (
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setStep(s => s - 1)}>
                  <ChevronLeft className="h-3 w-3" /> Zurück
                </Button>
              ) : <span />}
              {step < 5 ? (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1"
                  onClick={() => setStep(s => s + 1)}
                  disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
                >
                  Weiter <ChevronRight className="h-3 w-3" />
                </Button>
              ) : (
                <LoadingButton
                  onClick={() => addMutation.mutate()}
                  loading={addMutation.isPending}
                  disabled={addMutation.isPending || !canSubmit}
                  className="gap-1"
                >
                  Ziel speichern
                </LoadingButton>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Noch keine Ziele gesetzt</p>
      ) : (
        <div className="space-y-3">
          {goals.map(g => {
            const current = getCurrent(g.type);
            const pct = Math.min(100, g.target > 0 ? (current / g.target) * 100 : 0);
            const done = pct >= 100;
            const remaining = Math.max(0, g.target - current);
            const typeConfig = GOAL_TYPES.find(t => t.value === g.type);
            const days = daysUntil(g.deadline);
            const deadlineSoon = days !== null && days >= 0 && days <= 30;
            return (
              <div key={g.id} className="space-y-1.5 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {done && <Check className="h-3 w-3 text-profit" />}
                    <span className="text-xs font-medium truncate max-w-[150px]">{g.title}</span>
                    <span className="text-[10px] bg-secondary px-1 py-0.5 rounded text-muted-foreground">{typeConfig?.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                    <button onClick={() => deleteMutation.mutate(g.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${done ? "bg-profit" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {g.type === "units"
                      ? `${Math.round(current)} / ${g.target} Einh.`
                      : g.type === "units_per_year"
                        ? `${Math.round(current)} / ${g.target} Einh./Jahr`
                        : `${formatCurrency(current)} / ${formatCurrency(g.target)}`}
                    {!done && remaining > 0 && (
                      <span className="ml-1 text-primary font-medium">
                        · Noch {g.type === "units" || g.type === "units_per_year" ? `${Math.round(remaining)} Einh.` : formatCurrency(remaining)}
                      </span>
                    )}
                  </span>
                  {g.deadline && (
                    <span className={deadlineSoon ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                      {days !== null && days >= 0 && days <= 30 ? `In ${days} Tagen` : new Date(g.deadline).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
                {g.reason && (
                  <p className="text-[10px] text-muted-foreground italic border-l-2 border-primary/30 pl-2 mt-1">„{g.reason}"</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortfolioGoals;
