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
      warmRent: property.warmRent ?? property.monthlyRent,
      monthlyExpenses: property.monthlyExpenses,
      monthlyCreditRate: property.monthlyCreditRate,
      remainingDebt: property.remainingDebt,
      interestRate: property.interestRate,
      sqm: property.sqm,
      commercialSqm: property.commercialSqm ?? 0,
      yearBuilt: property.yearBuilt,
      ownership: property.ownership,
      restnutzungsdauer: property.restnutzungsdauer ?? "",
      buildingSharePercent: property.buildingSharePercent ?? 80,
      monthlyCashflow: property.monthlyCashflow ?? calcMonthlyCashflow(property.monthlyRent, property.monthlyExpenses, property.monthlyCreditRate),
      instandhaltungProSqm: (() => {
        const total = (property.sqm || 0) + (property.commercialSqm || 0);
        return total > 0 && property.monthlyExpenses ? Math.round((property.monthlyExpenses * 12) / total * 10) / 10 : 20;
      })(),
      parkingUnderground: property.parkingUnderground ?? 0,
      parkingStellplatz: property.parkingStellplatz ?? 0,
      parkingGarage: property.parkingGarage ?? 0,
      gardenSqm: property.gardenSqm ?? 0,
      otherRentableNotes: property.otherRentableNotes ?? "",
    },
  });

  /* Auto-calc monthlyCashflow = Miete - Kosten - Rate (editierbar) */
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
    const total = (Number(sqm) || 0) + (Number(commercialSqm) || 0);
    const eurPerSqm = Number(instandhaltungProSqm) || 20;
    if (total > 0 && eurPerSqm >= 0) {
      const cost = Math.round((total * eurPerSqm) / 12 * 100) / 100;
      setValue("monthlyExpenses", cost, { shouldValidate: false });
    }
  }, [sqm, commercialSqm, instandhaltungProSqm, setValue]);

  useEffect(() => {
    if (open) {
      const totalSqm = (property.sqm || 0) + (property.commercialSqm || 0);
      const instandhaltung = totalSqm > 0 && property.monthlyExpenses ? Math.round((property.monthlyExpenses * 12) / totalSqm * 10) / 10 : 20;
      reset({
        name: property.name,
        address: property.address,
        type: property.type as FormData["type"],
        units: property.units,
        purchasePrice: property.purchasePrice,
        purchaseDate: property.purchaseDate,
        currentValue: property.currentValue,
        monthlyRent: property.monthlyRent,
        warmRent: property.warmRent ?? property.monthlyRent,
        monthlyExpenses: property.monthlyExpenses,
        monthlyCreditRate: property.monthlyCreditRate,
        remainingDebt: property.remainingDebt,
        interestRate: property.interestRate,
        sqm: property.sqm,
        commercialSqm: property.commercialSqm ?? 0,
        yearBuilt: property.yearBuilt,
        ownership: property.ownership,
        restnutzungsdauer: property.restnutzungsdauer ?? "",
        buildingSharePercent: property.buildingSharePercent ?? 80,
        monthlyCashflow: property.monthlyCashflow ?? calcMonthlyCashflow(property.monthlyRent, property.monthlyExpenses, property.monthlyCreditRate),
        instandhaltungProSqm: instandhaltung,
        parkingUnderground: property.parkingUnderground ?? 0,
        parkingStellplatz: property.parkingStellplatz ?? 0,
        parkingGarage: property.parkingGarage ?? 0,
        gardenSqm: property.gardenSqm ?? 0,
        otherRentableNotes: property.otherRentableNotes ?? "",
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
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" aria-label="Objekt bearbeiten">
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
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Instandhaltungsrücklage (€/qm · Jahr)" name="instandhaltungProSqm" type="number" register={register} errors={errors} />
              <EditField label="Kosten/M (EUR)" name="monthlyExpenses" type="number" register={register} errors={errors} />
            </div>
              <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-monthlyRent" className="text-xs text-muted-foreground">Kaltmiete/M (EUR)</Label>
                <Input id="edit-monthlyRent" type="number" step="any" className="h-9 text-sm"
                  {...register("monthlyRent")}
                  onChange={(e) => {
                    const newKalt = Number(e.target.value) || 0;
                    const oldKalt = Number(watch("monthlyRent")) || 0;
                    const oldWarm = Number(watch("warmRent")) || 0;
                    const nk = oldWarm - oldKalt;
                    setValue("monthlyRent", newKalt, { shouldValidate: true });
                    setValue("warmRent", newKalt + nk, { shouldValidate: true });
                  }}
                />
                <div className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
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
              <EditField label="Warmmiete/M (EUR)" name="warmRent" type="number" register={register} errors={errors} />
              <div className="space-y-1.5">
                <Label htmlFor="edit-nkRent" className="text-xs text-muted-foreground">Nebenkosten/M (EUR)</Label>
                <Input id="edit-nkRent" type="number" step="any" className="h-9 text-sm"
                  value={Math.round(((Number(watch("warmRent")) || 0) - (Number(watch("monthlyRent")) || 0)) * 100) / 100}
                  onChange={(e) => {
                    const newNK = Number(e.target.value) || 0;
                    const kalt = Number(watch("monthlyRent")) || 0;
                    setValue("warmRent", kalt + newNK, { shouldValidate: true });
                  }}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Zwei Werte eingeben → der dritte wird berechnet. Alle editierbar.</p>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Rate/M (EUR)" name="monthlyCreditRate" type="number" register={register} errors={errors} />
            </div>
            <EditField label="Cashflow/M (berechnet, editierbar)" name="monthlyCashflow" type="number" register={register} errors={errors} />
            <EditField label="Zinssatz (%)" name="interestRate" type="number" register={register} errors={errors} />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Objektdetails</h4>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Wohnfläche (m²)" name="sqm" type="number" register={register} errors={errors} />
              <EditField label="Gewerbefläche (m²)" name="commercialSqm" type="number" register={register} errors={errors} />
              <EditField label="Baujahr" name="yearBuilt" type="number" register={register} errors={errors} />
              <EditField label="Gebäudeanteil (%)" name="buildingSharePercent" type="number" register={register} errors={errors} />
              <EditField label="Restnutzungsdauer (Jahre)" name="restnutzungsdauer" type="number" register={register} errors={errors} />
            </div>
            <p className="text-[11px] text-muted-foreground">Wohnfläche + Gewerbefläche = vermietete Fläche (Kaltmiete/qm). Gebäudeanteil und Restnutzungsdauer für AfA.</p>
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Parkplätze / separat vermietbar</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <EditField label="Tiefgarage (Anz.)" name="parkingUnderground" type="number" register={register} errors={errors} />
                <EditField label="Stellplatz (Anz.)" name="parkingStellplatz" type="number" register={register} errors={errors} />
                <EditField label="Garage (Anz.)" name="parkingGarage" type="number" register={register} errors={errors} />
                <EditField label="Garten (m²/Anz.)" name="gardenSqm" type="number" register={register} errors={errors} />
              </div>
              <div className="mt-2">
                <Label htmlFor="edit-otherRentableNotes" className="text-xs text-muted-foreground">Sonstiges separat vermietbar</Label>
                <Input id="edit-otherRentableNotes" className="h-9 text-sm mt-1" placeholder="z.B. Keller, Dachterrasse" {...register("otherRentableNotes")} />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full touch-target min-h-[44px]" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Wird gespeichert…" : "Änderungen speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditPropertyDialog;
