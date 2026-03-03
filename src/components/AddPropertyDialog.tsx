import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fullSchema = z.object({
  name: z.string().min(2, "Name zu kurz"),
  address: z.string().min(5, "Adresse angeben"),
  type: z.enum(["MFH", "ZFH", "ETW", "EFH", "Gewerbe"]),
  units: z.coerce.number().min(1),
  ownership: z.string().min(1, "Besitzverhältnis wählen"),
  purchasePrice: z.coerce.number().min(1),
  purchaseDate: z.string().min(1, "Kaufdatum angeben"),
  currentValue: z.coerce.number().min(1),
  monthlyRent: z.coerce.number().min(0),
  monthlyExpenses: z.coerce.number().min(0),
  monthlyCreditRate: z.coerce.number().min(0),
  remainingDebt: z.coerce.number().min(0),
  interestRate: z.coerce.number().min(0).max(20),
  sqm: z.coerce.number().min(1),
  yearBuilt: z.coerce.number().min(1800).max(2030),
});

type FormData = z.infer<typeof fullSchema>;

const STEP_LABELS = ["Grunddaten", "Finanzen", "Objektdetails"];

const STEP_FIELDS: (keyof FormData)[][] = [
  ["name", "address", "type", "ownership", "units"],
  ["purchasePrice", "purchaseDate", "currentValue", "remainingDebt", "monthlyRent", "monthlyExpenses", "monthlyCreditRate", "interestRate"],
  ["sqm", "yearBuilt"],
];

const StepIndicator = ({ current, total }: { current: number; total: number }) => (
  <div className="flex items-center justify-center gap-0 mb-6">
    {Array.from({ length: total }, (_, i) => {
      const isCompleted = i < current;
      const isActive = i === current;
      return (
        <div key={i} className="flex items-center">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300",
              isCompleted && "bg-primary text-primary-foreground",
              isActive && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
              !isCompleted && !isActive && "bg-muted text-muted-foreground"
            )}
          >
            {i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={cn(
                "w-12 h-0.5 transition-all duration-300",
                i < current ? "bg-primary" : "bg-muted"
              )}
            />
          )}
        </div>
      );
    })}
  </div>
);

const FORM_DEFAULTS: FormData = {
  name: "",
  address: "",
  type: "ETW",
  ownership: "Privat",
  units: 1,
  purchasePrice: 300000,
  purchaseDate: new Date().toISOString().split("T")[0],
  currentValue: 300000,
  monthlyRent: 1000,
  monthlyExpenses: 200,
  monthlyCreditRate: 800,
  remainingDebt: 250000,
  interestRate: 3.5,
  sqm: 80,
  yearBuilt: 1970,
};

const AddPropertyDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const { addProperty } = useProperties();

  /* #9: Form draft auto-recovery via sessionStorage */
  const { values: draftValues, setValues: setDraftValues, clearDraft, hasDraft } = useFormDraft<FormData>("add-property", FORM_DEFAULTS);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: hasDraft ? draftValues : FORM_DEFAULTS,
  });

  /* Sync form changes to draft storage — use watch subscription to avoid infinite loop */
  useEffect(() => {
    const subscription = watch((values) => {
      setDraftValues(values as FormData);
    });
    return () => subscription.unsubscribe();
  }, [watch, setDraftValues]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) { setStep(0); reset(FORM_DEFAULTS); clearDraft(); }
    },
    [reset, clearDraft]
  );

  const goNext = useCallback(async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => Math.min(s + 1, 2));
  }, [step, trigger]);

  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  const onSubmit = async (data: FormData) => {
    const monthlyCashflow = data.monthlyRent - data.monthlyExpenses - data.monthlyCreditRate;
    await addProperty({ ...data, monthlyCashflow, location: "" } as Omit<import("@/data/mockData").Property, "id">);
    toast.success(`${data.name} wurde angelegt!`);
    reset(FORM_DEFAULTS);
    clearDraft();
    setStep(0);
    setOpen(false);
  };

  const Field = ({
    label,
    name,
    type = "text",
    placeholder,
  }: {
    label: string;
    name: keyof FormData;
    type?: string;
    placeholder?: string;
  }) => (
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
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* UI-UPDATE-50: Tooltip on add property trigger — avoid double-asChild nesting */}
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-add-property>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Objekt hinzufügen</span>
              <span className="sm:hidden">Hinzufügen</span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Neues Objekt anlegen (Ctrl+N)</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neues Objekt anlegen</DialogTitle>
          <DialogDescription>
            Schritt {step + 1} von 3 &mdash; {STEP_LABELS[step]}
          </DialogDescription>
        </DialogHeader>

        <StepIndicator current={step} total={3} />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className={step === 0 ? "block" : "hidden"}>
            <div className="space-y-3">
              <Field label="Bezeichnung *" name="name" placeholder="z.B. MFH Duesseldorf" />
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs text-muted-foreground">Adresse</Label>
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
                  <Label className="text-xs text-muted-foreground">Objekttyp</Label>
                  <Select value={watch("type")} onValueChange={(v) => setValue("type", v as FormData["type"])}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
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
                  <Label className="text-xs text-muted-foreground">Besitzverhältnis</Label>
                  <GesellschaftSelector
                    value={watch("ownership") || ""}
                    onChange={(v) => setValue("ownership", v, { shouldValidate: true })}
                    error={errors.ownership?.message as string}
                  />
                </div>
                <Field label="Einheiten" name="units" type="number" placeholder="1" />
              </div>
            </div>
          </div>

          <div className={step === 1 ? "block" : "hidden"}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kaufpreis (EUR)" name="purchasePrice" type="number" placeholder="300000" />
                <Field label="Kaufdatum" name="purchaseDate" type="date" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Aktueller Wert (EUR)" name="currentValue" type="number" placeholder="320000" />
                <Field label="Restschuld (EUR)" name="remainingDebt" type="number" placeholder="250000" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Miete/M (EUR)" name="monthlyRent" type="number" placeholder="1200" />
                <Field label="Kosten/M (EUR)" name="monthlyExpenses" type="number" placeholder="300" />
                <Field label="Rate/M (EUR)" name="monthlyCreditRate" type="number" placeholder="800" />
              </div>
              <Field label="Zinssatz (%)" name="interestRate" type="number" placeholder="3.5" />
            </div>
          </div>

          <div className={step === 2 ? "block" : "hidden"}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Wohnfläche (m2)" name="sqm" type="number" placeholder="120" />
                <Field label="Baujahr" name="yearBuilt" type="number" placeholder="1975" />
              </div>
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
              <Button type="submit" className="flex-1">
                Objekt anlegen
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddPropertyDialog;
