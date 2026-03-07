import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useForm, UseFormRegister, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Property } from "@/data/mockData";
import { toast } from "sonner";
import { editPropertyFormSchema, type EditPropertyFormData, PROPERTY_TYPES } from "@/lib/schemas";
import { calcMonthlyCashflow } from "@/lib/calculations";
import { scrollToFirstError } from "@/lib/scrollToFirstError";

type FormData = EditPropertyFormData;

interface EditFieldProps {
  label: string;
  name: keyof FormData;
  type?: string;
  placeholder?: string;
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
}

const EditField = memo(({ label, name, type = "text", placeholder, register, errors }: EditFieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={`edit-${name}`} className="text-xs text-muted-foreground">{label}</Label>
    <Input
      id={`edit-${name}`}
      type={type}
      placeholder={placeholder}
      step={type === "number" ? "any" : undefined}
      className="h-9 text-sm"
      {...register(name)}
    />
    {errors[name] && <p className="text-xs text-destructive">{errors[name]?.message as string}</p>}
  </div>
));
EditField.displayName = "EditField";

const EditPropertyDialog = ({ property }: { property: Property }) => {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { updateProperty } = useProperties();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(editPropertyFormSchema),
    defaultValues: {
      name: property.name,
      address: property.address,
      type: property.type as FormData["type"],
      units: property.units,
      purchasePrice: property.purchasePrice,
      purchaseDate: property.purchaseDate,
      currentValue: property.currentValue,
      monthlyRent: property.monthlyRent,
      monthlyExpenses: property.monthlyExpenses,
      monthlyCreditRate: property.monthlyCreditRate,
      remainingDebt: property.remainingDebt,
      interestRate: property.interestRate,
      sqm: property.sqm,
      yearBuilt: property.yearBuilt,
      ownership: property.ownership,
      restnutzungsdauer: property.restnutzungsdauer ?? "",
      buildingSharePercent: property.buildingSharePercent ?? 80,
      monthlyCashflow: property.monthlyCashflow ?? calcMonthlyCashflow(property.monthlyRent, property.monthlyExpenses, property.monthlyCreditRate),
    },
  });

  /* Auto-calc monthlyCashflow = Miete - Kosten - Rate (editierbar) */
  const monthlyRent = watch("monthlyRent");
  const monthlyExpenses = watch("monthlyExpenses");
  const monthlyCreditRate = watch("monthlyCreditRate");
  useEffect(() => {
    setValue("monthlyCashflow", calcMonthlyCashflow(Number(monthlyRent), Number(monthlyExpenses), Number(monthlyCreditRate)), { shouldValidate: false });
  }, [monthlyRent, monthlyExpenses, monthlyCreditRate, setValue]);

  useEffect(() => {
    if (open) {
      reset({
        name: property.name,
        address: property.address,
        type: property.type as FormData["type"],
        units: property.units,
        purchasePrice: property.purchasePrice,
        purchaseDate: property.purchaseDate,
        currentValue: property.currentValue,
        monthlyRent: property.monthlyRent,
        monthlyExpenses: property.monthlyExpenses,
        monthlyCreditRate: property.monthlyCreditRate,
        remainingDebt: property.remainingDebt,
        interestRate: property.interestRate,
        sqm: property.sqm,
        yearBuilt: property.yearBuilt,
        ownership: property.ownership,
        restnutzungsdauer: property.restnutzungsdauer ?? "",
        buildingSharePercent: property.buildingSharePercent ?? 80,
        monthlyCashflow: property.monthlyCashflow ?? calcMonthlyCashflow(property.monthlyRent, property.monthlyExpenses, property.monthlyCreditRate),
      });
    }
  }, [open, property, reset]);

  const onSubmit = useCallback(async (data: FormData) => {
    const monthlyCashflow = typeof data.monthlyCashflow === "number" ? data.monthlyCashflow : calcMonthlyCashflow(data.monthlyRent, data.monthlyExpenses, data.monthlyCreditRate);
    const restnutzungsdauer = data.restnutzungsdauer !== "" && data.restnutzungsdauer != null ? Number(data.restnutzungsdauer) : undefined;
    const buildingSharePercent = data.buildingSharePercent !== "" && data.buildingSharePercent != null ? Number(data.buildingSharePercent) : 80;
    await updateProperty(property.id, { ...data, monthlyCashflow, restnutzungsdauer, buildingSharePercent } as Partial<Property>);
    toast.success(`${data.name} wurde aktualisiert!`);
    setOpen(false);
  }, [property.id, updateProperty]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Objekt bearbeiten</DialogTitle>
          <DialogDescription>Aktualisiere die Daten deiner Immobilie.</DialogDescription>
        </DialogHeader>

        {/* IMPROVE-37: Form sections with clear visual separators and bold headings for better field grouping */}
        <form ref={formRef} onSubmit={handleSubmit(onSubmit, () => scrollToFirstError(formRef.current))} className="space-y-4 mt-2">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Grunddaten</h4>
            <EditField label="Bezeichnung" name="name" register={register} errors={errors} />
            <div className="space-y-1.5">
              <Label htmlFor="edit-address" className="text-xs text-muted-foreground">Adresse</Label>
              <AddressAutocomplete
                id="edit-address"
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
                    {PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
              <EditField label="Einheiten" name="units" type="number" register={register} errors={errors} />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Finanzen</h4>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Kaufpreis (EUR)" name="purchasePrice" type="number" register={register} errors={errors} />
              <EditField label="Kaufdatum" name="purchaseDate" type="date" register={register} errors={errors} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Aktueller Wert (EUR)" name="currentValue" type="number" register={register} errors={errors} />
              <EditField label="Restschuld (EUR)" name="remainingDebt" type="number" register={register} errors={errors} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <EditField label="Miete/M (EUR)" name="monthlyRent" type="number" register={register} errors={errors} />
              <EditField label="Kosten/M (EUR)" name="monthlyExpenses" type="number" register={register} errors={errors} />
              <EditField label="Rate/M (EUR)" name="monthlyCreditRate" type="number" register={register} errors={errors} />
            </div>
            <EditField label="Cashflow/M (berechnet, editierbar)" name="monthlyCashflow" type="number" register={register} errors={errors} />
            <EditField label="Zinssatz (%)" name="interestRate" type="number" register={register} errors={errors} />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Objektdetails</h4>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Wohnfläche (m²)" name="sqm" type="number" register={register} errors={errors} />
              <EditField label="Baujahr" name="yearBuilt" type="number" register={register} errors={errors} />
              <EditField label="Gebäudeanteil (%)" name="buildingSharePercent" type="number" register={register} errors={errors} />
              <EditField label="Restnutzungsdauer (Jahre)" name="restnutzungsdauer" type="number" register={register} errors={errors} />
            </div>
            <p className="text-[11px] text-muted-foreground">Gebäudeanteil und Restnutzungsdauer für AfA und 15%-Sanierungsregel.</p>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Wird gespeichert…" : "Änderungen speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditPropertyDialog;
