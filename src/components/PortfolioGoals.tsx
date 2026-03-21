import { useEffect, useMemo, useState, useRef } from "react";
import { Target, Plus, Trash2, Check, ChevronRight, ChevronLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { fireConfetti } from "@/lib/confetti";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/LoadingButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toastSuccess } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { fromTable } from "@/lib/typedSupabase";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/context/PropertyContext";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

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

function daysUntilDeadline(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Goal | null>(null);
  const [editForm, setEditForm] = useState({ title: "", target: 0, deadline: "", reason: "" });
  const [showShortGoalConfirm, setShowShortGoalConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
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
        document.getElementById("goals")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [location.state, location.pathname, navigate]);

  const unitsPerYearCurrent = useMemo(
    () => unitsAcquiredLast12Months(properties),
    [properties],
  );

  const { data: goals = [] } = useQuery({
    queryKey: queryKeys.portfolioGoals.all,
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
      const safeCurrent = Number.isFinite(currentValue) ? currentValue : 0;
      const safeTarget = Number.isFinite(form.target) ? form.target : 0;
      const payload: Record<string, unknown> = {
        user_id: user.id,
        title: form.title.trim(),
        type: form.type,
        target: safeTarget,
        current_value: safeCurrent,
        deadline: form.deadline || null,
        reason: form.reason.trim() || null,
      };
      let { error } = await fromTable("portfolio_goals").insert(payload);
      /* Retry without reason if column doesn't exist (alte DB-Schemas) */
      if (error && (error.message?.includes("reason") || error.message?.includes("42703"))) {
        delete payload.reason;
        const retry = await fromTable("portfolio_goals").insert(payload);
        error = retry.error;
      }
      if (error) throw error;
    },
    onSuccess: () => {
      toastSuccess("Ziel gesetzt (SMART)");
      setForm(INITIAL_FORM);
      setStep(1);
      setOpen(false);
      qc.invalidateQueries({ queryKey: queryKeys.portfolioGoals.all });
    },
    onError: (err) => handleError(err, { context: "supabase", toastMessage: "Fehler beim Speichern" }),
  });

  const selectedTypeConfig = GOAL_TYPES.find((t) => t.value === form.type);
  const currentValueForType = getCurrent(form.type);
  const canProceedStep1 = form.title.trim().length > 0 && form.type;
  const canProceedStep2 = form.target > 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const deadlineDays = form.deadline ? daysUntilDeadline(form.deadline) : null;
  const isFormDirty =
    form.title.trim() !== "" || form.target > 0 || form.reason.trim() !== "" || form.deadline !== "";
  const deadlineInFuture = deadlineDays !== null && deadlineDays > 0;
  const isShortGoal = deadlineDays !== null && deadlineDays > 0 && deadlineDays <= 30;
  const canSubmit = form.deadline.length > 0 && deadlineInFuture;
  const formatCurrent = (val: number) =>
    form.type === "units" || form.type === "units_per_year"
      ? `${Math.round(val)}`
      : formatCurrency(val);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fromTable("portfolio_goals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.portfolioGoals.all }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title?: string; target?: number; deadline?: string | null; reason?: string | null } }) => {
      const { error } = await fromTable("portfolio_goals").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toastSuccess("Ziel aktualisiert");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: queryKeys.portfolioGoals.all });
    },
    onError: (err) => handleError(err, { context: "supabase", toastMessage: "Fehler beim Speichern" }),
  });

  return (
    <div id="goals" className="gradient-card rounded-xl border border-border p-5 scroll-mt-24">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" /> Portfolio-Ziele
        </h3>
        <Dialog
          open={open}
          onOpenChange={(isOpen) => {
            if (isOpen) {
              setOpen(true);
              setStep(1);
              setForm(INITIAL_FORM);
              setShowShortGoalConfirm(false);
              setShowCloseConfirm(false);
            } else if (isFormDirty) {
              setShowCloseConfirm(true);
            } else {
              setOpen(false);
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

            {/* Step indicator – klickbare Buchstaben für direkten Sprung */}
            <div className="flex justify-between gap-1">
              {SMART_STEPS.map((s, i) => {
                const stepNum = i + 1;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStep(stepNum)}
                    className={cn(
                      "flex-1 rounded py-1 text-center text-[10px] font-medium transition-colors cursor-pointer hover:opacity-90",
                      stepNum === step ? "bg-primary text-primary-foreground" : stepNum < step ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-secondary text-muted-foreground hover:bg-secondary/80",
                    )}
                    title={`${s.label} – zu Schritt ${stepNum} springen`}
                  >
                    {s.short}
                  </button>
                );
              })}
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
                    <Label className="text-xs">Deadline * (muss in der Zukunft liegen)</Label>
                    <input
                      type="date"
                      min={todayStr}
                      value={form.deadline}
                      onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                      className="h-9 text-sm w-full rounded-md border border-input bg-background px-3 py-1"
                    />
                    {form.deadline && deadlineDays !== null && !deadlineInFuture && (
                      <p className="text-xs text-destructive">Die Deadline muss in der Zukunft liegen.</p>
                    )}
                    {form.deadline && isShortGoal && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Nur {deadlineDays} Tage – beim Speichern erfolgt eine Bestätigungsabfrage.</p>
                    )}
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
                  onClick={() => (isShortGoal ? setShowShortGoalConfirm(true) : addMutation.mutate())}
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
        <div className="py-6">
          <EmptyState
            icon={Target}
            title="Noch keine Ziele gesetzt"
            description="Setze dir SMART-Ziele für Portfoliowert, Cashflow oder Einheiten – mit Deadline und Fortschrittsanzeige."
            action={
              <Button size="sm" className="gap-1.5 touch-target min-h-[44px]" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Erstes Ziel anlegen
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(g => {
            const current = getCurrent(g.type);
            const pct = Math.min(100, g.target > 0 ? (current / g.target) * 100 : 0);
            const done = pct >= 100;
            const remaining = Math.max(0, g.target - current);
            const typeConfig = GOAL_TYPES.find(t => t.value === g.type);
            const days = daysUntilDeadline(g.deadline);
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
                    <button onClick={() => { setEditTarget(g); setEditForm({ title: g.title, target: g.target, deadline: g.deadline || "", reason: g.reason || "" }); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all" aria-label="Ziel bearbeiten">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => setDeleteTargetId(g.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all" aria-label="Ziel löschen">
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

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ziel bearbeiten</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Bezeichnung</Label>
                <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zielwert</Label>
                <NumberInput value={editForm.target} onChange={v => setEditForm(f => ({ ...f, target: v }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deadline</Label>
                <input type="date" min={todayStr} value={editForm.deadline} onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))} className="h-9 text-sm w-full rounded-md border border-input bg-background px-3 py-1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Grund (optional)</Label>
                <textarea value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))} className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" placeholder="Warum ist dir das Ziel wichtig?" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>Abbrechen</Button>
                <LoadingButton
                  size="sm"
                  loading={updateMutation.isPending}
                  disabled={!editForm.title.trim() || editForm.target <= 0}
                  onClick={() => {
                    if (!editTarget) return;
                    updateMutation.mutate({
                      id: editTarget.id,
                      data: {
                        title: editForm.title.trim(),
                        target: editForm.target,
                        deadline: editForm.deadline || null,
                        reason: editForm.reason.trim() || null,
                      },
                    });
                  }}
                >
                  Speichern
                </LoadingButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ziel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Portfolio-Ziel wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTargetId) { deleteMutation.mutate(deleteTargetId); setDeleteTargetId(null); } }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showShortGoalConfirm} onOpenChange={setShowShortGoalConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kurze Deadline bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Die Deadline liegt in nur {deadlineDays} Tagen. Bist du sicher, dass du dieses Ziel so setzen möchtest?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { addMutation.mutate(); setShowShortGoalConfirm(false); }}>
              Ja, Ziel speichern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Formular schließen?</AlertDialogTitle>
            <AlertDialogDescription>
              Es sind noch Eingaben im Formular. Beim Schließen gehen diese verloren. Wirklich schließen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpen(false);
                setForm(INITIAL_FORM);
                setStep(1);
                setShowCloseConfirm(false);
              }}
            >
              Ja, schließen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PortfolioGoals;
