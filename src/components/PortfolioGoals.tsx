import { useState } from "react";
import { Target, Plus, Trash2, TrendingUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";

interface Goal {
  id: string;
  title: string;
  type: "value" | "cashflow" | "units" | "equity";
  target: number;
  current_value: number;
  deadline: string | null;
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
  { value: "cashflow", label: "Monatl. Cashflow", unit: "€/M" },
  { value: "units", label: "Anzahl Einheiten", unit: "Einh." },
  { value: "equity", label: "Eigenkapital", unit: "€" },
];

const PortfolioGoals = ({ currentStats }: PortfolioGoalsProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "value" as Goal["type"], target: 0, deadline: "" });

  const { data: goals = [] } = useQuery({
    queryKey: ["portfolio_goals"],
    queryFn: async () => {
      const { data } = await supabase.from("portfolio_goals" as any).select("*").order("created_at");
      return (data || []) as Goal[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.title.trim() || form.target <= 0) throw new Error("Ungültig");
      const currentValue = form.type === "value" ? currentStats.totalValue
        : form.type === "cashflow" ? currentStats.totalCashflow
        : form.type === "units" ? currentStats.totalUnits
        : currentStats.equity;
      const { error } = await supabase.from("portfolio_goals" as any).insert({
        user_id: user.id, title: form.title.trim(), type: form.type,
        target: form.target, current_value: currentValue,
        deadline: form.deadline || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ziel gesetzt");
      setForm({ title: "", type: "value", target: 0, deadline: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["portfolio_goals"] });
    },
    onError: () => toast.error("Fehler"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from("portfolio_goals" as any).delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio_goals"] }),
  });

  const getCurrent = (type: Goal["type"]) => {
    switch (type) {
      case "value": return currentStats.totalValue;
      case "cashflow": return currentStats.totalCashflow;
      case "units": return currentStats.totalUnits;
      case "equity": return currentStats.equity;
    }
  };

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" /> Portfolio-Ziele
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" /> Ziel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Neues Ziel setzen</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Bezeichnung *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-9 text-sm" placeholder="z.B. 2 Mio. € Portfoliowert" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kategorie</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as Goal["type"] }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Zielwert *</Label>
                  <NumberInput value={form.target} onChange={v => setForm(f => ({ ...f, target: v }))} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deadline</Label>
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="h-9 text-sm w-full rounded-md border border-input bg-background px-3 py-1" />
                </div>
              </div>
              <Button onClick={() => addMutation.mutate()} className="w-full" disabled={addMutation.isPending || !form.title.trim() || form.target <= 0}>
                Ziel speichern
              </Button>
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
            const typeConfig = GOAL_TYPES.find(t => t.value === g.type);
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
                    {g.type === "units" ? `${Math.round(current)} / ${g.target} Einh.` : `${formatCurrency(current)} / ${formatCurrency(g.target)}`}
                  </span>
                  {g.deadline && <span>{new Date(g.deadline).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortfolioGoals;
