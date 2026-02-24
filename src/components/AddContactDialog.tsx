import { useState, useCallback } from "react";
import { Plus, ChevronRight, ChevronLeft, Contact2, Wrench, Building, Shield, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { isValidEmail } from "@/lib/validation";

const CATEGORIES = [
  { value: "Handwerker", icon: Wrench, description: "Elektriker, Klempner, Maler, …" },
  { value: "Hausverwaltung", icon: Building, description: "Externe Verwaltung, WEG, …" },
  { value: "Versicherung", icon: Shield, description: "Gebäude-, Haftpflicht-, …" },
  { value: "Sonstiges", icon: Briefcase, description: "Notar, Steuerberater, …" },
];

const STEP_LABELS = ["Kategorie", "Kontaktdaten", "Adresse & Notizen"];

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

interface AddContactDialogProps {
  onCreated?: () => void;
  trigger?: React.ReactNode;
}

const AddContactDialog = ({ onCreated, trigger }: AddContactDialogProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", company: "", category: "Handwerker",
    email: "", phone: "", address: "", notes: "",
  });

  const resetForm = useCallback(() => {
    setForm({ name: "", company: "", category: "Handwerker", email: "", phone: "", address: "", notes: "" });
    setStep(0);
  }, []);

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v);
    if (!v) resetForm();
  }, [resetForm]);

  const canGoNext = step === 0
    ? !!form.category
    : step === 1
    ? !!form.name.trim()
    : true;

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    if (form.email && !isValidEmail(form.email)) { toast.error("Ungültige E-Mail-Adresse"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        name: form.name.trim(),
        company: form.company || null,
        category: form.category,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success(`${form.name} angelegt`);
      handleOpenChange(false);
      qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
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
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Kontakt
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Contact2 className="h-5 w-5 text-primary" /> Neuen Kontakt anlegen
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Schritt {step + 1} von 3 — {STEP_LABELS[step]}</p>
        </DialogHeader>

        <StepIndicator current={step} total={3} />

        <div className="space-y-4 min-h-[220px]">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                      form.category === cat.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-secondary/50"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", form.category === cat.value ? "bg-primary/10" : "bg-secondary")}>
                      <Icon className={cn("h-5 w-5", form.category === cat.value ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{cat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{cat.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-9 text-sm" placeholder="Vollständiger Name" autoFocus />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Firma</Label>
                  <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="h-9 text-sm" placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kategorie</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-Mail</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefon</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-9 text-sm" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Adresse</Label>
                <AddressAutocomplete value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notizen</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="text-sm min-h-[80px]" placeholder="Besonderheiten, Preise, Empfehlung, …" />
              </div>
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
            <Button onClick={handleSave} className="flex-1" disabled={saving || !form.name.trim()}>
              {saving ? "Anlegen…" : "Kontakt anlegen"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddContactDialog;
