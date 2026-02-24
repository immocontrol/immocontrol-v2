import { useState, useCallback } from "react";
import { Plus, ChevronRight, ChevronLeft, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { isValidEmail } from "@/lib/validation";

const STEP_LABELS = ["Persönliche Daten", "Mietdetails", "Zusammenfassung"];

const StepIndicator = ({ current, total }: { current: number; total: number }) => (
  <div className="flex items-center justify-center gap-0 mb-6">
    {Array.from({ length: total }, (_, i) => {
      const isCompleted = i < current;
      const isActive = i === current;
      return (
        <div key={i} className="flex items-center">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300",
            isCompleted && "bg-primary text-primary-foreground",
            isActive && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
            !isCompleted && !isActive && "bg-muted text-muted-foreground"
          )}>
            {i + 1}
          </div>
          {i < total - 1 && (
            <div className={cn("w-12 h-0.5 transition-all duration-300", i < current ? "bg-primary" : "bg-muted")} />
          )}
        </div>
      );
    })}
  </div>
);

interface AddTenantDialogProps {
  propertyId: string;
  propertyName?: string;
  onCreated?: () => void;
  trigger?: React.ReactNode;
}

const AddTenantDialog = ({ propertyId, propertyName, onCreated, trigger }: AddTenantDialogProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    unit_label: "", move_in_date: "", monthly_rent: 0, deposit: 0,
  });

  const resetForm = useCallback(() => {
    setForm({ first_name: "", last_name: "", email: "", phone: "", unit_label: "", move_in_date: "", monthly_rent: 0, deposit: 0 });
    setStep(0);
  }, []);

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v);
    if (!v) resetForm();
  }, [resetForm]);

  const canGoNext = step === 0
    ? !!form.first_name.trim() && !!form.last_name.trim()
    : step === 1
    ? form.monthly_rent > 0
    : true;

  const handleSave = async () => {
    if (!user || !form.first_name.trim() || !form.last_name.trim()) return;
    if (form.email && !isValidEmail(form.email)) { toast.error("Ungültige E-Mail-Adresse"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("tenants").insert({
        property_id: propertyId,
        landlord_id: user.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        unit_label: form.unit_label,
        move_in_date: form.move_in_date || null,
        monthly_rent: form.monthly_rent,
        deposit: form.deposit,
      });
      if (error) throw error;
      toast.success(`${form.first_name} ${form.last_name} angelegt`);
      handleOpenChange(false);
      qc.invalidateQueries({ queryKey: queryKeys.tenants.byProperty(propertyId) });
      onCreated?.();
    } catch {
      toast.error("Fehler beim Anlegen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> Mieter
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Neuen Mieter anlegen
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Schritt {step + 1} von 3 — {STEP_LABELS[step]}
            {propertyName && <span> · {propertyName}</span>}
          </p>
        </DialogHeader>

        <StepIndicator current={step} total={3} />

        <div className="space-y-4 min-h-[200px]">
          {step === 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Vorname *</Label>
                  <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className="h-9 text-sm" autoFocus />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nachname *</Label>
                  <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className="h-9 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">E-Mail</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefon</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Einheit</Label>
                <Input value={form.unit_label} onChange={e => setForm(f => ({ ...f, unit_label: e.target.value }))} placeholder="z.B. EG links, OG rechts" className="h-9 text-sm" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Miete/Monat *</Label>
                  <NumberInput value={form.monthly_rent} onChange={v => setForm(f => ({ ...f, monthly_rent: v }))} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kaution</Label>
                  <NumberInput value={form.deposit} onChange={v => setForm(f => ({ ...f, deposit: v }))} className="h-9 text-sm" placeholder="0" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Einzugsdatum</Label>
                <Input type="date" value={form.move_in_date} onChange={e => setForm(f => ({ ...f, move_in_date: e.target.value }))} className="h-9 text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">Kaution üblicherweise 2–3 Monatsmieten</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="gradient-card rounded-xl border border-border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zusammenfassung</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{form.first_name} {form.last_name}</span>
                  </div>
                  {form.email && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">E-Mail</span>
                      <span className="font-medium">{form.email}</span>
                    </div>
                  )}
                  {form.unit_label && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Einheit</span>
                      <span className="font-medium">{form.unit_label}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Miete/Monat</span>
                    <span className="font-medium text-profit">{form.monthly_rent.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                  </div>
                  {form.deposit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Kaution</span>
                      <span className="font-medium">{form.deposit.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                    </div>
                  )}
                  {form.move_in_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Einzug</span>
                      <span className="font-medium">{new Date(form.move_in_date).toLocaleDateString("de-DE")}</span>
                    </div>
                  )}
                </div>
              </div>
              {form.email && (
                <p className="text-xs text-muted-foreground">Nach dem Anlegen kannst du den Mieter ins Mieterportal einladen.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" /> Zurück
            </Button>
          )}
          {step < 2 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)} className="flex-1 gap-1.5" disabled={!canGoNext}>
              Weiter <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? "Anlegen…" : "Mieter anlegen"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddTenantDialog;
