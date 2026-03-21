import { useState, useRef } from "react";
import { Shield, Plus, AlertTriangle, Check, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toastSuccess } from "@/lib/toastMessages";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/typedSupabase";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";

interface Insurance {
  id: string;
  property_id: string;
  type: string;
  provider: string;
  annual_premium: number;
  renewal_date: string | null;
  policy_number: string | null;
  notes: string | null;
}

interface InsuranceTrackerProps {
  propertyId: string;
}

const INSURANCE_TYPES = [
  "Gebäudeversicherung", "Haftpflichtversicherung", "Hausratversicherung",
  "Rechtsschutzversicherung", "Elementarschadenversicherung", "Sonstige",
];

const InsuranceTracker = ({ propertyId }: InsuranceTrackerProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "Gebäudeversicherung", provider: "", annual_premium: 0,
    renewal_date: "", policy_number: "", notes: "",
  });
  const lastDeletedInsuranceIdRef = useRef<string | null>(null);

  const { data: insurances = [] } = useQuery({
    queryKey: ["insurances", propertyId],
    queryFn: async () => {
      const { data } = await fromTable("property_insurances")
        .select("*")
        .eq("property_id", propertyId)
        .order("renewal_date", { ascending: true });
      return (data || []) as unknown as Insurance[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.provider.trim()) throw new Error("Anbieter erforderlich");
      const { error } = await fromTable("property_insurances").insert({
        property_id: propertyId,
        user_id: user.id,
        type: form.type,
        provider: form.provider.trim(),
        annual_premium: form.annual_premium,
        renewal_date: form.renewal_date || null,
        policy_number: form.policy_number || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toastSuccess("Versicherung gespeichert");
      setForm({ type: "Gebäudeversicherung", provider: "", annual_premium: 0, renewal_date: "", policy_number: "", notes: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["insurances", propertyId] });
    },
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "property_insurances.insert", showToast: false });
      toastErrorWithRetry("Fehler beim Speichern", () => addMutation.mutate());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("property_insurances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurances", propertyId] }),
    onError: (e: unknown) => {
      handleError(e, { context: "supabase", details: "property_insurances.delete", showToast: false });
      toastErrorWithRetry("Fehler beim Löschen", () => { if (lastDeletedInsuranceIdRef.current) deleteMutation.mutate(lastDeletedInsuranceIdRef.current); });
    },
  });

  const totalAnnual = insurances.reduce((s, i) => s + (i.annual_premium || 0), 0);
  const now = new Date();
  const expiringSoon = insurances.filter(i => {
    if (!i.renewal_date) return false;
    const days = (new Date(i.renewal_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 60 && days >= 0;
  });

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" /> Versicherungen
          {totalAnnual > 0 && (
            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">
              {formatCurrency(totalAnnual)}/Jahr
            </span>
          )}
          {expiringSoon.length > 0 && (
            <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" /> {expiringSoon.length} läuft ab
            </span>
          )}
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" /> Versicherung
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Versicherung eintragen</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Art</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSURANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Anbieter *</Label>
                  <Input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} className="h-9 text-sm" placeholder="z.B. Allianz" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Jahresbeitrag</Label>
                  <NumberInput value={form.annual_premium} onChange={v => setForm(f => ({ ...f, annual_premium: v }))} className="h-9 text-sm" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Ablaufdatum</Label>
                  <input type="date" value={form.renewal_date} onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))} className="h-9 text-sm w-full rounded-md border border-input bg-background px-3 py-1" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pol.-Nr.</Label>
                  <Input value={form.policy_number} onChange={e => setForm(f => ({ ...f, policy_number: e.target.value }))} className="h-9 text-sm" />
                </div>
              </div>
              <Button onClick={() => addMutation.mutate()} className="w-full" disabled={addMutation.isPending || !form.provider.trim()}>
                Speichern
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {insurances.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Keine Versicherungen eingetragen</p>
      ) : (
        <div className="space-y-2">
          {insurances.map(ins => {
            const daysToRenewal = ins.renewal_date
              ? Math.ceil((new Date(ins.renewal_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null;
            const isExpiringSoon = daysToRenewal !== null && daysToRenewal <= 60 && daysToRenewal >= 0;
            const isExpired = daysToRenewal !== null && daysToRenewal < 0;
            return (
              <div key={ins.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/40 group">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isExpiringSoon ? "bg-gold/10" : isExpired ? "bg-loss/10" : "bg-primary/10"}`}>
                  <Shield className={`h-3.5 w-3.5 ${isExpiringSoon ? "text-gold" : isExpired ? "text-loss" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{ins.type}</span>
                    <span className="text-[10px] text-muted-foreground">{ins.provider}</span>
                    {isExpiringSoon && <span className="text-[10px] bg-gold/10 text-gold px-1 rounded">in {daysToRenewal}d</span>}
                    {isExpired && <span className="text-[10px] bg-loss/10 text-loss px-1 rounded">abgelaufen</span>}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    {ins.annual_premium > 0 && <span>{formatCurrency(ins.annual_premium)}/J</span>}
                    {ins.renewal_date && <span>bis {new Date(ins.renewal_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                    {ins.policy_number && <span>Nr: {ins.policy_number}</span>}
                  </div>
                </div>
                <button onClick={() => setDeleteTargetId(ins.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 touch-target min-h-[44px] sm:min-h-0" aria-label="Versicherung löschen">
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
            <AlertDialogTitle>Versicherung löschen?</AlertDialogTitle>
            <AlertDialogDescription>Die Versicherung wird unwiderruflich entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId) {
                  lastDeletedInsuranceIdRef.current = deleteTargetId;
                  deleteMutation.mutate(deleteTargetId);
                  setDeleteTargetId(null);
                }
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InsuranceTracker;
