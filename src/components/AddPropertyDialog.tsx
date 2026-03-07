import { useState, useCallback, useEffect, useRef, memo } from "react";
import { useForm, UseFormRegister, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addPropertyFormSchema, type AddPropertyFormData } from "@/lib/schemas";
import { Plus, ChevronRight, ChevronLeft } from "lucide-react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import GesellschaftSelector from "@/components/GesellschaftSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProperties } from "@/context/PropertyContext";
import { useAccessibility } from "@/components/AccessibilityProvider";
import { toast } from "sonner";
import { focusNextField } from "@/hooks/useEnterToNext";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { scrollToFirstError } from "@/lib/scrollToFirstError";
import { calcMonthlyCashflow } from "@/lib/calculations";
import { StepIndicator } from "@/components/StepIndicator";

type FormData = AddPropertyFormData;

/* FIX: Move Field component outside AddPropertyDialog to prevent re-creation on every
   render. Previously defined as a closure inside the component, causing React to unmount/
   remount inputs on each keystroke (via watch subscription) → mobile focus loss. */
interface FieldProps {
  label: string;
  name: keyof FormData;
  type?: string;
  placeholder?: string;
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
}

const Field = memo(({ label, name, type = "text", placeholder, register, errors }: FieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={name} className="text-xs text-muted-foreground">{label}</Label>
    <Input
      id={name}
      type={type}
      placeholder={placeholder}
      step={type === "number" ? "any" : undefined}
      className="h-9 text-sm"
      {...register(name)}
    />
    {errors[name] && <p className="text-xs text-destructive">{errors[name]?.message as string}</p>}
  </div>
));
Field.displayName = "Field";

const STEP_LABELS = ["Grunddaten", "Finanzen", "Objektdetails"];

const STEP_FIELDS: (keyof FormData)[][] = [
  ["name", "address", "type", "ownership", "units"],
  ["purchasePrice", "purchaseDate", "currentValue", "remainingDebt", "monthlyRent", "monthlyExpenses", "monthlyCreditRate", "monthlyCashflow", "interestRate"],
  ["sqm", "yearBuilt"],
];

const FORM_DEFAULTS: FormData = {
  name: "",
  address: "",
  type: "ETW",
  ownership: "",
  units: 0,
  purchasePrice: 0,
  purchaseDate: "",
  currentValue: 0,
  monthlyRent: 0,
  monthlyExpenses: 0,
  monthlyCreditRate: 0,
  remainingDebt: 0,
  interestRate: 0,
  sqm: 0,
  yearBuilt: 0,
  restnutzungsdauer: undefined,
  buildingSharePercent: 80,
  monthlyCashflow: 0,
};

const AddPropertyDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { addProperty, properties } = useProperties();
  const { announce } = useAccessibility();

  /* #9: Form draft auto-recovery via sessionStorage */
  const { values: draftValues, setValues: setDraftValues, clearDraft, hasDraft } = useFormDraft<FormData>("add-property", FORM_DEFAULTS);

  const form = useForm<FormData>({
    resolver: zodResolver(addPropertyFormSchema),
    defaultValues: hasDraft ? draftValues : FORM_DEFAULTS,
  });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = form;

  /* Sync form changes to draft storage — use watch subscription to avoid infinite loop */
  useEffect(() => {
    const subscription = watch((values) => {
      setDraftValues(values as FormData);
    });
    return () => subscription.unsubscribe();
  }, [watch, setDraftValues]);

  /* Auto-fill currentValue from purchasePrice wenn noch 0 (editierbar falls abweichend) */
  const purchasePrice = watch("purchasePrice");
  const currentValue = watch("currentValue");
  useEffect(() => {
    const p = Number(purchasePrice) || 0;
    const cv = Number(currentValue) || 0;
    if (p > 0 && cv === 0) setValue("currentValue", p, { shouldValidate: false });
  }, [purchasePrice, currentValue, setValue]);

  /* Auto-calc monthlyCashflow = Miete - Kosten - Rate (editierbar falls Sonderfall) */
  const monthlyRent = watch("monthlyRent");
  const monthlyExpenses = watch("monthlyExpenses");
  const monthlyCreditRate = watch("monthlyCreditRate");
  useEffect(() => {
    setValue("monthlyCashflow", calcMonthlyCashflow(Number(monthlyRent), Number(monthlyExpenses), Number(monthlyCreditRate)), { shouldValidate: false });
  }, [monthlyRent, monthlyExpenses, monthlyCreditRate, setValue]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) { setStep(0); reset(FORM_DEFAULTS); clearDraft(); }
    },
    [reset, clearDraft]
  );

  const goNext = useCallback(async (e?: React.MouseEvent) => {
    e?.preventDefault();
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) {
      setStep((s) => Math.min(s + 1, 2));
    } else {
      /* Fix 5: Show validation hint and focus first invalid field.
         Use form.formState.errors (live ref) instead of closure-captured errors. */
      const liveErrors = form.formState.errors;
      const firstInvalidField = STEP_FIELDS[step].find((f) => liveErrors[f]);
      if (firstInvalidField) {
        const fieldEl = document.getElementById(firstInvalidField);
        if (fieldEl) {
          fieldEl.focus();
          fieldEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        const errorMsg = liveErrors[firstInvalidField]?.message as string;
        toast.error(errorMsg || `Bitte "${firstInvalidField}" ausfüllen`);
      } else {
        toast.error("Bitte alle Pflichtfelder ausfüllen");
      }
    }
  }, [step, trigger, form]);

  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  const onSubmit = async (data: FormData) => {
    const wasFirst = properties.length === 0;
    const monthlyCashflow = typeof data.monthlyCashflow === "number" ? data.monthlyCashflow : calcMonthlyCashflow(data.monthlyRent, data.monthlyExpenses, data.monthlyCreditRate);
    const restnutzungsdauer = data.restnutzungsdauer !== "" && data.restnutzungsdauer != null ? Number(data.restnutzungsdauer) : undefined;
    const buildingSharePercent = data.buildingSharePercent !== "" && data.buildingSharePercent != null ? Number(data.buildingSharePercent) : 80;
    try {
      await addProperty({ ...data, monthlyCashflow, location: "", restnutzungsdauer, buildingSharePercent } as Omit<import("@/data/mockData").Property, "id">);
    } catch (e: unknown) {
      handleError(e, { context: "supabase", details: "properties.insert", showToast: false });
      toastErrorWithRetry("Objekt anlegen fehlgeschlagen", () => handleSubmit(onSubmit)());
      return;
    }
    if (wasFirst) {
      toast.success("Dein erstes Objekt ist angelegt – dein Portfolio startet hier.");
      announce("Erstes Objekt angelegt. Portfolio startet hier.");
    } else {
      toast.success(`${data.name} wurde angelegt!`);
      announce(`${data.name} wurde angelegt.`);
    }
    reset(FORM_DEFAULTS);
    clearDraft();
    setStep(0);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* UI-UPDATE-50: Tooltip on add property trigger — avoid double-asChild nesting */}
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-add-property data-testid="add-property">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Objekt hinzufügen</span>
              <span className="sm:hidden">Hinzufügen</span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Neues Objekt anlegen (Ctrl+N)</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Neues Objekt anlegen</DialogTitle>
          <DialogDescription>
            Schritt {step + 1} von 3 — {STEP_LABELS[step]}
          </DialogDescription>
        </DialogHeader>

        <StepIndicator current={step} total={3} />

        <form ref={formRef} onSubmit={handleSubmit(onSubmit, () => scrollToFirstError(formRef.current))} onKeyDown={(e) => {
          /* Prevent Enter key from submitting the form on non-final steps */
          if (e.key === "Enter" && step < 2) {
            e.preventDefault();
            goNext();
          }
        }} className="space-y-5">
          <div className={step === 0 ? "block" : "hidden"}>
            <div className="space-y-3">
              <Field label="Bezeichnung *" name="name" placeholder="z.B. MFH Duesseldorf" register={register} errors={errors} />
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs text-muted-foreground">Adresse *</Label>
                <AddressAutocomplete
                  id="address"
                  value={watch("address") || ""}
                  onChange={(val) => setValue("address", val, { shouldValidate: true })}
                  placeholder="Strasse Nr, PLZ Stadt"
                />
                {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Objekttyp *</Label>
                  <Select value={watch("type")} onValueChange={(v) => {
                    setValue("type", v as FormData["type"]);
                    /* FIX: After dropdown selection, focus next field */
                    const trigger = document.querySelector<HTMLElement>('[data-field="type"]');
                    focusNextField(trigger);
                  }}>
                    <SelectTrigger className="h-9 text-sm" data-field="type"><SelectValue placeholder="Typ wählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MFH">MFH</SelectItem>
                      <SelectItem value="ZFH">ZFH</SelectItem>
                      <SelectItem value="ETW">ETW</SelectItem>
                      <SelectItem value="EFH">EFH</SelectItem>
                      <SelectItem value="Gewerbe">Gewerbe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Besitzverhältnis *</Label>
                  <GesellschaftSelector
                    value={watch("ownership") || ""}
                    onChange={(v) => setValue("ownership", v, { shouldValidate: true })}
                    error={errors.ownership?.message as string}
                  />
                </div>
                <Field label="Einheiten *" name="units" type="number" placeholder="1" register={register} errors={errors} />
              </div>
            </div>
          </div>

          <div className={step === 1 ? "block" : "hidden"}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kaufpreis (EUR)" name="purchasePrice" type="number" placeholder="300000" register={register} errors={errors} />
                <Field label="Kaufdatum" name="purchaseDate" type="date" register={register} errors={errors} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Aktueller Wert (EUR)" name="currentValue" type="number" placeholder="320000" register={register} errors={errors} />
                <Field label="Restschuld (EUR)" name="remainingDebt" type="number" placeholder="250000" register={register} errors={errors} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Miete/M (EUR)" name="monthlyRent" type="number" placeholder="1200" register={register} errors={errors} />
                <Field label="Kosten/M (EUR)" name="monthlyExpenses" type="number" placeholder="300" register={register} errors={errors} />
                <Field label="Rate/M (EUR)" name="monthlyCreditRate" type="number" placeholder="800" register={register} errors={errors} />
              </div>
              <Field label="Cashflow/M (berechnet, editierbar)" name="monthlyCashflow" type="number" placeholder="100" register={register} errors={errors} />
              <Field label="Zinssatz (%)" name="interestRate" type="number" placeholder="3.5" register={register} errors={errors} />
            </div>
          </div>

          <div className={step === 2 ? "block" : "hidden"}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Wohnfläche (m²)" name="sqm" type="number" placeholder="120" register={register} errors={errors} />
                <Field label="Baujahr" name="yearBuilt" type="number" placeholder="1975" register={register} errors={errors} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <Field label="Gebäudeanteil (%)" name="buildingSharePercent" type="number" placeholder="80" register={register} errors={errors} />
                <Field label="Restnutzungsdauer (Jahre)" name="restnutzungsdauer" type="number" placeholder="50" register={register} errors={errors} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Gebäudeanteil = Anteil des Kaufpreises, der auf das Gebäude entfällt (Rest = Grund und Boden). Nur der Gebäudeanteil ist abschreibbar. Restnutzungsdauer für lineare AfA (z.B. 50 Jahre).
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={goBack} className="gap-1.5">
                <ChevronLeft className="h-4 w-4" /> Zurück
              </Button>
            )}
            {step < 2 ? (
              <Button type="button" onClick={goNext} className="flex-1 gap-1.5">
                Weiter <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" className="flex-1" disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? "Wird angelegt…" : "Objekt anlegen"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddPropertyDialog;
