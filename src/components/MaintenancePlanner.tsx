import { useState } from "react";
import { Wrench, Plus, AlertTriangle, Clock, Check, Trash2, Sparkles, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { handleError } from "@/lib/handleError";
import { isDeepSeekConfigured, suggestMaintenanceNotes } from "@/integrations/ai/extractors";
import { toastErrorWithRetry, toastSuccess } from "@/lib/toastMessages";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/typedSupabase";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";

interface MaintenanceItem {
  id: string;
  property_id: string;
  title: string;
  category: string;
  priority: "low" | "medium" | "high";
  estimated_cost: number;
  planned_date: string | null;
  completed: boolean;
  notes: string | null;
}

interface MaintenancePlannerProps {
  propertyId: string;
}

const CATEGORIES = ["Dach", "Heizung", "Elektrik", "Sanitär", "Fassade", "Fenster", "Keller", "Sonstiges"];
const PRIORITIES = [
  { value: "high", label: "Dringend", color: "bg-loss/10 text-loss" },
  { value: "medium", label: "Mittel", color: "bg-gold/10 text-gold" },
  { value: "low", label: "Geplant", color: "bg-secondary text-muted-foreground" },
];

const MaintenancePlanner = ({ propertyId }: MaintenancePlannerProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [suggestNotesLoading, setSuggestNotesLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", category: "Sonstiges", priority: "medium" as MaintenanceItem["priority"],
    estimated_cost: 0, planned_date: "", notes: "",
  });

  const { data: items = [] } = useQuery({
    queryKey: ["maintenance", propertyId],
    queryFn: async () => {
      const { data } = await fromTable("maintenance_items")
        .select("*")
        .eq("property_id", propertyId)
        .order("priority", { ascending: false })
        .order("planned_date", { ascending: true });
      return (data || []) as unknown as MaintenanceItem[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.title.trim()) throw new Error("Titel erforderlich");
      const { error } = await fromTable("maintenance_items").insert({
        property_id: propertyId,
        user_id: user.id,
        title: form.title.trim(),
        category: form.category,
        priority: form.priority,
        estimated_cost: form.estimated_cost,
        planned_date: form.planned_date || null,
        notes: form.notes || null,
        completed: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toastSuccess("Maßnahme geplant");
      setForm({ title: "", category: "Sonstiges", priority: "medium", estimated_cost: 0, planned_date: "", notes: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["maintenance", propertyId] });
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "maintenance_items.insert", showToast: false });
      toastErrorWithRetry("Fehler beim Planen", () => addMutation.mutate());
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      await fromTable("maintenance_items").update({ completed }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance", propertyId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fromTable("maintenance_items").delete().eq("id", id); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance", propertyId] });
      setDeleteTargetId(null);
    },
  });

  const pending = items.filter(i => !i.completed);
  const totalEstimated = pending.reduce((s, i) => s + (i.estimated_cost || 0), 0);

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" /> Instandhaltungsplanung
          {pending.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4">{pending.length}</Badge>
          )}
          {totalEstimated > 0 && (
            <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full font-medium">
              ~{formatCurrency(totalEstimated)}
            </span>
          )}
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" /> Maßnahme
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Maßnahme planen</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Titel *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-9 text-sm" placeholder="z.B. Dachsanierung" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Kategorie</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Priorität</Label>
                  <Select value={form.priority} /* FIX-17: Replace `as any` with proper type assertion */
                    onValueChange={v => setForm(f => ({ ...f, priority: v as MaintenanceItem["priority"] }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Schätzkosten</Label>
                  <NumberInput value={form.estimated_cost} onChange={v => setForm(f => ({ ...f, estimated_cost: v }))} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Geplant für</Label>
                  <input type="date" value={form.planned_date} onChange={e => setForm(f => ({ ...f, planned_date: e.target.value }))} className="h-9 text-sm w-full rounded-md border border-input bg-background px-3 py-1" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Notiz</Label>
                  {isDeepSeekConfigured() && (form.title.trim() || form.category !== "Sonstiges") && (
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={async () => {
                      setSuggestNotesLoading(true);
                      try {
                        const text = await suggestMaintenanceNotes(form.title.trim() || form.category, form.category);
                        if (text) setForm(f => ({ ...f, notes: text }));
                      } catch (e) {
                        handleError(e, { context: "ai", details: "suggestMaintenanceNotes", showToast: true });
                      } finally {
                        setSuggestNotesLoading(false);
                      }
                    }} disabled={suggestNotesLoading} type="button" aria-label="KI Notiz-Vorschlag">
                      {suggestNotesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      KI Notiz
                    </Button>
                  )}
                </div>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="h-9 text-sm" placeholder="Optional" />
              </div>
              <LoadingButton onClick={() => addMutation.mutate()} className="w-full" loading={addMutation.isPending} disabled={addMutation.isPending || !form.title.trim()}>
                Planen
              </LoadingButton>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Keine geplanten Maßnahmen</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const priorityCfg = PRIORITIES.find(p => p.value === item.priority);
            return (
              <div key={item.id} className={`flex items-center gap-3 p-2.5 rounded-lg bg-secondary/40 group transition-opacity ${item.completed ? "opacity-40" : ""}`}>
                <button onClick={() => toggleMutation.mutate({ id: item.id, completed: !item.completed })} className="shrink-0">
                  {item.completed ? <Check className="h-4 w-4 text-profit" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-medium ${item.completed ? "line-through" : ""} truncate`}>{item.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${priorityCfg?.color}`}>{priorityCfg?.label}</span>
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    {item.estimated_cost > 0 && <span>~{formatCurrency(item.estimated_cost)}</span>}
                    {item.planned_date && <span>{new Date(item.planned_date).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}</span>}
                  </div>
                </div>
                <button onClick={() => setDeleteTargetId(item.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0" aria-label="Maßnahme löschen">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Maßnahme löschen?</AlertDialogTitle>
            <AlertDialogDescription>Die geplante Maßnahme wird unwiderruflich entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTargetId) deleteMutation.mutate(deleteTargetId); }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MaintenancePlanner;
