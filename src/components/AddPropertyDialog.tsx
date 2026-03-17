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
import { toastSuccess, toastError } from "@/lib/toastMessages";
import { focusNextField } from "@/hooks/useEnterToNext";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";
import { scrollToFirstError } from "@/lib/scrollToFirstError";
import { useFocusFirstInput } from "@/hooks/useFocusFirstInput";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useKeyboardAwareScroll } from "@/components/mobile/MobileKeyboardAwareScroll";
import { useIsMobile } from "@/hooks/use-mobile";
import { calcMonthlyCashflow } from "@/lib/calculations";
import { formatCurrency, DATE_INPUT_PLACEHOLDER } from "@/lib/formatters";
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

const STEP_LABELS = ["Grunddaten", "Finanzen", "Details (optional)"];

/** Nur die Felder validieren, die der User wirklich ausfüllen muss. Rest wird berechnet. */
const STEP_FIELDS: (keyof FormData)[][] = [
  ["name", "address", "type", "ownership", "units", "sqm", "commercialSqm"],
  ["purchasePrice", "monthlyRent"],
  [],
];

const getDefaultPurchaseDate = () => new Date().toISOString().slice(0, 10);

const FORM_DEFAULTS: FormData = {
  name: "",
  address: "",
  type: "ETW",
  ownership: "",
  units: 1,
  purchasePrice: 0,
  purchaseDate: getDefaultPurchaseDate(),
  currentValue: 0,
  monthlyRent: 0,
  warmRent: undefined as number | undefined,
  monthlyExpenses: 0,
  monthlyCreditRate: 0,
  remainingDebt: 0,
  interestRate: 0,
  sqm: 0,
  commercialSqm: 0,
  yearBuilt: 0,
  restnutzungsdauer: undefined,
  buildingSharePercent: 80,
  monthlyCashflow: 0,
  instandhaltungProSqm: 20,
  parkingUnderground: 0,
  parkingStellplatz: 0,
  parkingGarage: 0,
  gardenSqm: 0,
  otherRentableNotes: "",
};

const AddPropertyDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { addProperty, properties } = useProperties();
  const { announce } = useAccessibility();
  const isMobile = useIsMobile();
  useKeyboardAwareScroll({ enabled: isMobile && open, offset: 80 });

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
    formState: { errors, isSubmitting, isDirty },
  } = form;

  useUnsavedChanges(open && isDirty);

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

  /* Instandhaltungsrücklage: Kosten/M = (Wohnfläche + Gewerbefläche) * €/qm·Jahr / 12 */
  const sqm = watch("sqm");
  const commercialSqm = watch("commercialSqm");
  const instandhaltungProSqm = watch("instandhaltungProSqm");
  useEffect(() => {
    const totalSqm = (Number(sqm) || 0) + (Number(commercialSqm) || 0);
    const eurPerSqm = Number(instandhaltungProSqm) || 20;
    if (totalSqm > 0 && eurPerSqm >= 0) {
      const cost = Math.round((totalSqm * eurPerSqm) / 12 * 100) / 100;
      setValue("monthlyExpenses", cost, { shouldValidate: false });
    }
  }, [sqm, commercialSqm, instandhaltungProSqm, setValue]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) { setStep(0); reset(FORM_DEFAULTS); clearDraft(); }
    },
    [reset, clearDraft]
  );

  useFocusFirstInput(open, formRef);

  const goNext = useCallback(async (e?: React.MouseEvent) => {
    e?.preventDefault();
    const fieldsToValidate = STEP_FIELDS[step];
    const valid = fieldsToValidate.length > 0 ? await trigger(fieldsToValidate) : true;
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
        toastError(errorMsg || `Bitte "${firstInvalidField}" ausfüllen`);
      } else {
        toastError("Bitte alle Pflichtfelder ausfüllen");
      }
    }
  }, [step, trigger, form]);

  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  const onSubmit = async (data: FormData) => {
    const wasFirst = properties.length === 0;
    const purchaseDate = data.purchaseDate?.trim() || getDefaultPurchaseDate();
    const currentValue = Number(data.currentValue) > 0 ? Number(data.currentValue) : Number(data.purchasePrice) || 0;
    const monthlyCashflow = typeof data.monthlyCashflow === "number" ? data.monthlyCashflow : calcMonthlyCashflow(data.monthlyRent, data.monthlyExpenses, data.monthlyCreditRate);
    const restnutzungsdauer = data.restnutzungsdauer !== "" && data.restnutzungsdauer != null ? Number(data.restnutzungsdauer) : undefined;
    const buildingSharePercent = data.buildingSharePercent !== "" && data.buildingSharePercent != null ? Number(data.buildingSharePercent) : 80;
    const payload = {
      ...data,
      purchaseDate,
      currentValue: currentValue || Number(data.purchasePrice),
      monthlyCashflow,
      location: "",
      restnutzungsdauer,
      buildingSharePercent,
    } as Omit<import("@/data/mockData").Property, "id">;
    try {
      await addProperty(payload);
    } catch (e: unknown) {
      handleError(e, { context: "supabase", details: "properties.insert", showToast: false });
      toastErrorWithRetry("Objekt anlegen fehlgeschlagen", () => handleSubmit(onSubmit)());
      return;
    }
    if (wasFirst) {
      toastSuccess("Dein erstes Objekt ist angelegt – dein Portfolio startet hier.");
      announce("Erstes Objekt angelegt. Portfolio startet hier.");
    } else {
      toastSuccess(`${data.name} wurde angelegt!`);
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="Wohnfläche (m²) *" name="sqm" type="number" placeholder="z.B. 120" register={register} errors={errors} />
                <Field label="Gewerbefläche (m²)" name="commercialSqm" type="number" placeholder="0" register={register} errors={errors} />
              </div>
              <p className="text-[11px] text-muted-foreground">Wohnfläche + Gewerbefläche = vermietete Fläche (für Kaltmiete/qm und Kostenberechnung).</p>
            </div>
          </div>

          <div className={step === 1 ? "block" : "hidden"}>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Nur Kaufpreis und Miete sind Pflicht – der Rest wird berechnet oder kann später ergänzt werden.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kaufpreis (EUR) *" name="purchasePrice" type="number" placeholder="300000" register={register} errors={errors} />
                <div className="space-y-1.5">
                  <Label htmlFor="purchaseDate" className="text-xs text-muted-foreground">Kaufdatum</Label>
                  <Input id="purchaseDate" type="date" className="h-9 text-sm" title={`Format: ${DATE_INPUT_PLACEHOLDER}`} {...register("purchaseDate")} />
                  <p className="text-[10px] text-muted-foreground">Format: {DATE_INPUT_PLACEHOLDER}</p>
                  {errors.purchaseDate && <p className="text-xs text-destructive">{errors.purchaseDate?.message as string}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="monthlyRent" className="text-xs text-muted-foreground">Kaltmiete/M (EUR) *</Label>
                  <Input id="monthlyRent" type="number" step="any" className="h-9 text-sm" placeholder="1200"
                    {...register("monthlyRent", {
                      onChange: (e) => {
                        const newKalt = Number((e.target as HTMLInputElement).value) || 0;
                        const oldKalt = Number(watch("monthlyRent")) || 0;
                        const oldWarm = Number(watch("warmRent")) || 0;
                        const nk = oldWarm - oldKalt;
                        setValue("monthlyRent", newKalt, { shouldValidate: true });
                        setValue("warmRent", newKalt + nk, { shouldValidate: true });
                      },
                    })}
                  />
                  <div className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1" title="Durchschnittliche Kaltmiete pro m² vermieteter Fläche (Wohnfläche + Gewerbefläche)">
                    Kaltmiete/qm: {(() => {
                      const kalt = Number(watch("monthlyRent")) || 0;
                      const w = Number(watch("sqm")) || 0;
                      const g = Number(watch("commercialSqm")) || 0;
                      const total = w + g;
                      return total > 0 && kalt >= 0 ? `${(kalt / total).toFixed(2)} €/m²` : "–";
                    })()}
                  </div>
                  {errors.monthlyRent && <p className="text-xs text-destructive">{errors.monthlyRent.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="warmRent" className="text-xs text-muted-foreground">Warmmiete/M (optional)</Label>
                  <Input id="warmRent" type="number" step="any" className="h-9 text-sm" placeholder="1400"
                    value={watch("warmRent") ?? ""}
                    {...register("warmRent")}
                  />
                  {errors.warmRent && <p className="text-xs text-destructive">{errors.warmRent?.message as string}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nkRent" className="text-xs text-muted-foreground">Nebenkosten/M (berechnet)</Label>
                  <Input id="nkRent" type="number" step="any" className="h-9 text-sm bg-muted/50" placeholder="200"
                    value={Math.round(((Number(watch("warmRent")) || 0) - (Number(watch("monthlyRent")) || 0)) * 100) / 100}
                    onChange={(e) => {
                      const newNK = Number(e.target.value) || 0;
                      const kalt = Number(watch("monthlyRent")) || 0;
                      setValue("warmRent", kalt + newNK, { shouldValidate: true });
                    }}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Wird automatisch berechnet</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">Aktueller Wert</span>
                  <span>{formatCurrency(Number(watch("currentValue")) || Number(purchasePrice) || 0)}</span>
                  <span className="text-muted-foreground">Cashflow/M</span>
                  <span>{formatCurrency(calcMonthlyCashflow(Number(monthlyRent), Number(monthlyExpenses), Number(monthlyCreditRate)))}</span>
                </div>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Finanzierung &amp; Kosten (optional)</summary>
                <div className="pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Restschuld (EUR)" name="remainingDebt" type="number" placeholder="0" register={register} errors={errors} />
                    <Field label="Rate/M (EUR)" name="monthlyCreditRate" type="number" placeholder="0" register={register} errors={errors} />
                  </div>
                  <Field label="Zinssatz (%)" name="interestRate" type="number" placeholder="0" register={register} errors={errors} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Instandhaltung €/qm·Jahr" name="instandhaltungProSqm" type="number" placeholder="20" register={register} errors={errors} />
                    <Field label="Kosten/M (EUR)" name="monthlyExpenses" type="number" placeholder="0" register={register} errors={errors} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Bei Wohnfläche in Schritt 3 wird Kosten/M aus Rücklage berechnet.</p>
                </div>
              </details>
            </div>
          </div>

          <div className={step === 2 ? "block" : "hidden"}>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Parkplätze, Gärten und sonstiges separat Vermietbares (optional).</p>
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Parkplätze / Stellplätze</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Tiefgarage (Anz.)" name="parkingUnderground" type="number" placeholder="0" register={register} errors={errors} />
                  <Field label="Stellplatz (Anz.)" name="parkingStellplatz" type="number" placeholder="0" register={register} errors={errors} />
                  <Field label="Garage (Anz.)" name="parkingGarage" type="number" placeholder="0" register={register} errors={errors} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Garten (m² oder Anz.)" name="gardenSqm" type="number" placeholder="0" register={register} errors={errors} />
                <div className="space-y-1.5">
                  <Label htmlFor="otherRentableNotes" className="text-xs text-muted-foreground">Sonstiges separat vermietbar</Label>
                  <Input
                    id="otherRentableNotes"
                    placeholder="z.B. Keller, Dachterrasse"
                    className="h-9 text-sm"
                    {...register("otherRentableNotes")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <Field label="Baujahr" name="yearBuilt" type="number" placeholder="0 oder z.B. 1975" register={register} errors={errors} />
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">AfA (Steuer) – optional</summary>
                <div className="pt-3 grid grid-cols-2 gap-3">
                  <Field label="Gebäudeanteil (%)" name="buildingSharePercent" type="number" placeholder="80" register={register} errors={errors} />
                  <Field label="Restnutzungsdauer (Jahre)" name="restnutzungsdauer" type="number" placeholder="50" register={register} errors={errors} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Nur Gebäudeanteil ist abschreibbar; Restnutzungsdauer für lineare AfA.</p>
              </details>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={goBack} className="gap-1.5 touch-target min-h-[44px]">
                <ChevronLeft className="h-4 w-4" /> Zurück
              </Button>
            )}
            {step < 2 ? (
              <Button type="button" onClick={goNext} className="flex-1 gap-1.5 touch-target min-h-[44px]">
                Weiter <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" className="flex-1 touch-target min-h-[44px]" disabled={isSubmitting} aria-busy={isSubmitting}>
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
