import { useState, useCallback, useRef } from "react";
import { Plus, ChevronRight, ChevronLeft, Contact2, Sparkles, Loader2 } from "lucide-react";
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
import { useAccessibility } from "@/components/AccessibilityProvider";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { CONTACT_CATEGORIES } from "@/lib/contactCategories";
import { contactFormSchema } from "@/lib/schemas";
import { StepIndicator } from "@/components/StepIndicator";
import { useFocusFirstInput } from "@/hooks/useFocusFirstInput";
import { isDeepSeekConfigured, suggestContactFollowUp } from "@/integrations/ai/extractors";

const STEP_LABELS = ["Kategorie", "Kontaktdaten", "Adresse & Notizen"];

interface AddContactDialogProps {
  onCreated?: () => void;
  trigger?: React.ReactNode;
}

const AddContactDialog = ({ onCreated, trigger }: AddContactDialogProps) => {
  const { user } = useAuth();
  const { announce } = useAccessibility();
  const qc = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [aiNotesLoading, setAiNotesLoading] = useState(false);

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

  useFocusFirstInput(open, contentRef);

  const canGoNext = step === 0
    ? !!form.category
    : step === 1
    ? !!form.name.trim()
    : true;

  const handleSave = async () => {
    if (!user) return;
    const parsed = contactFormSchema.safeParse(form);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const friendly: Record<string, string> = {
        name: "Bitte Namen eingeben.",
        email: "Bitte gültige E-Mail-Adresse eingeben.",
        phone: "Bitte gültige Telefonnummer eingeben.",
        category: "Bitte Kategorie wählen.",
      };
      const msg =
        first.name?.length ? friendly.name
        : first.email?.length ? friendly.email
        : first.phone?.length ? friendly.phone
        : first.category?.length ? friendly.category
        : "Bitte Name oder Kontaktdaten (E-Mail/Telefon) eingeben.";
      toast.error(msg);
      return;
    }
    setSaving(true);
    const data = parsed.data;
    try {
      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        name: data.name.trim(),
        company: data.company || null,
        category: data.category,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        notes: data.notes || null,
      });
      if (error) throw error;
      toast.success(`${data.name} angelegt`);
      announce(`${data.name} wurde als Kontakt angelegt.`);
      handleOpenChange(false);
      qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
      onCreated?.();
    } catch (err) {
      handleError(err, { context: "supabase", details: "contacts.insert", showToast: false });
      toastErrorWithRetry("Kontakt anlegen fehlgeschlagen", handleSave);
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

        <div ref={contentRef} className="space-y-4 min-h-[220px]">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {CONTACT_CATEGORIES.map(cat => {
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
                      {CONTACT_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
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
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Notizen</Label>
                  {isDeepSeekConfigured() && form.name.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={aiNotesLoading}
                      onClick={async () => {
                        setAiNotesLoading(true);
                        try {
                          const text = await suggestContactFollowUp({
                            name: form.name.trim(),
                            company: form.company || null,
                            category: form.category,
                            notes: form.notes || null,
                          });
                          if (text) setForm(f => ({ ...f, notes: text }));
                        } catch (e) {
                          handleError(e, { context: "ai", details: "suggestContactFollowUp", showToast: true });
                        } finally {
                          setAiNotesLoading(false);
                        }
                      }}
                    >
                      {aiNotesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      KI Vorschlag
                    </Button>
                  )}
                </div>
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
