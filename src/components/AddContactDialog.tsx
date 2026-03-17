import { useState, useCallback, useRef } from "react";
import { Plus, ChevronRight, ChevronLeft, Contact2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useAccessibility } from "@/components/AccessibilityProvider";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry, toastError, toastSuccess } from "@/lib/toastMessages";
import { CONTACT_CATEGORIES } from "@/lib/contactCategories";
import { contactFormSchema, type ContactFormDataUI } from "@/lib/schemas";
import { StepIndicator } from "@/components/StepIndicator";
import { useFocusFirstInput } from "@/hooks/useFocusFirstInput";
import { useKeyboardAwareScroll } from "@/components/mobile/MobileKeyboardAwareScroll";
import { useIsMobile } from "@/hooks/use-mobile";
import { isDeepSeekConfigured, suggestContactFollowUp } from "@/integrations/ai/extractors";

const STEP_LABELS = ["Kategorie", "Kontaktdaten", "Adresse & Notizen"];

interface AddContactDialogProps {
  onCreated?: () => void;
  trigger?: React.ReactNode;
}

const DEFAULT_VALUES: ContactFormDataUI = {
  name: "", company: "", category: "Handwerker", email: "", phone: "", address: "", notes: "",
};

const AddContactDialog = ({ onCreated, trigger }: AddContactDialogProps) => {
  const { user } = useAuth();
  const { announce } = useAccessibility();
  const qc = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [aiNotesLoading, setAiNotesLoading] = useState(false);
  const isMobile = useIsMobile();
  useKeyboardAwareScroll({ enabled: isMobile && open, offset: 80 });

  const form = useForm<ContactFormDataUI>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = form;
  const formValues = watch();

  const resetForm = useCallback(() => {
    reset(DEFAULT_VALUES);
    setStep(0);
  }, [reset]);

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v);
    if (!v) resetForm();
  }, [resetForm]);

  useFocusFirstInput(open, contentRef);

  const canGoNext = step === 0
    ? !!formValues.category
    : step === 1
    ? !!formValues.name?.trim()
    : true;

  const onValidSubmit = useCallback(async (data: ContactFormDataUI) => {
    if (!user) return;
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
      toastSuccess(`${data.name} angelegt`);
      announce(`${data.name} wurde als Kontakt angelegt.`);
      handleOpenChange(false);
      qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
      onCreated?.();
    } catch (err) {
      handleError(err, { context: "supabase", details: "contacts.insert", showToast: false });
      toastErrorWithRetry("Kontakt anlegen fehlgeschlagen", () => form.handleSubmit(onValidSubmit)());
    }
  }, [user, announce, qc, onCreated, handleOpenChange, form]);

  const handleSave = handleSubmit(onValidSubmit);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            {trigger || (
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Kontakt
              </Button>
            )}
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Kontakt anlegen (Ctrl+N auf Kontaktseite)</TooltipContent>
      </Tooltip>
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
                const isSelected = formValues.category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setValue("category", cat.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                      isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/50"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isSelected ? "bg-primary/10" : "bg-secondary")}>
                      <Icon className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
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
                  <Input {...register("name")} className="h-9 text-sm" placeholder="Vollständiger Name" autoFocus />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Firma</Label>
                  <Input {...register("company")} className="h-9 text-sm" placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kategorie</Label>
                  <Select value={formValues.category} onValueChange={v => setValue("category", v as ContactFormDataUI["category"])}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONTACT_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-Mail</Label>
                  <Input type="email" {...register("email")} className="h-9 text-sm" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefon</Label>
                  <Input {...register("phone")} className="h-9 text-sm" />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Adresse</Label>
                <AddressAutocomplete value={formValues.address} onChange={v => setValue("address", v)} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Notizen</Label>
                  {isDeepSeekConfigured() && formValues.name?.trim() && (
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
                            name: formValues.name?.trim() ?? "",
                            company: formValues.company || null,
                            category: formValues.category,
                            notes: formValues.notes || null,
                          });
                          if (text) setValue("notes", text);
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
                <Textarea {...register("notes")} className="text-sm min-h-[80px]" placeholder="Besonderheiten, Preise, Empfehlung, …" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1.5 touch-target min-h-[44px]">
              <ChevronLeft className="h-4 w-4" /> Zurück
            </Button>
          )}
          {step < 2 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)} className="flex-1 gap-1.5 touch-target min-h-[44px]" disabled={!canGoNext}>
              Weiter <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} className="flex-1 touch-target min-h-[44px]" disabled={isSubmitting || !formValues.name?.trim()}>
              {isSubmitting ? "Anlegen…" : "Kontakt anlegen"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddContactDialog;
