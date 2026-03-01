import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const schema = z.object({
  name: z.string().min(2, "Name zu kurz"),
  address: z.string().min(5, "Adresse angeben"),
  type: z.enum(["MFH", "ZFH", "ETW", "EFH", "Gewerbe"]),
  units: z.coerce.number().min(1),
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
  ownership: z.string().min(1, "Besitzverhaeltnis waehlen"),
});

type FormData = z.infer<typeof schema>;

const EditPropertyDialog = ({ property }: { property: Property }) => {
  const [open, setOpen] = useState(false);
  const { updateProperty } = useProperties();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
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
    },
  });

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
      });
    }
  }, [open, property, reset]);

  const onSubmit = useCallback(async (data: FormData) => {
    const monthlyCashflow = data.monthlyRent - data.monthlyExpenses - data.monthlyCreditRate;
    /* FIX-35: Replace `as any` with proper type assertion */
    await updateProperty(property.id, { ...data, monthlyCashflow } as Partial<Property>);
    toast.success(`${data.name} wurde aktualisiert!`);
    setOpen(false);
  }, [property.id, updateProperty]);

  const Field = ({ label, name, type = "text", placeholder }: { label: string; name: keyof FormData; type?: string; placeholder?: string }) => (
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
  );

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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Grunddaten</h4>
            <Field label="Bezeichnung" name="name" />
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
                    <SelectItem value="MFH">MFH</SelectItem>
                    <SelectItem value="ZFH">ZFH</SelectItem>
                    <SelectItem value="ETW">ETW</SelectItem>
                    <SelectItem value="EFH">EFH</SelectItem>
                    <SelectItem value="Gewerbe">Gewerbe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Besitzverhaeltnis</Label>
                <GesellschaftSelector
                  value={watch("ownership") || ""}
                  onChange={(v) => setValue("ownership", v, { shouldValidate: true })}
                  error={errors.ownership?.message as string}
                />
              </div>
              <Field label="Einheiten" name="units" type="number" />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Finanzen</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kaufpreis (EUR)" name="purchasePrice" type="number" />
              <Field label="Kaufdatum" name="purchaseDate" type="date" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Aktueller Wert (EUR)" name="currentValue" type="number" />
              <Field label="Restschuld (EUR)" name="remainingDebt" type="number" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Miete/M (EUR)" name="monthlyRent" type="number" />
              <Field label="Kosten/M (EUR)" name="monthlyExpenses" type="number" />
              <Field label="Rate/M (EUR)" name="monthlyCreditRate" type="number" />
            </div>
            <Field label="Zinssatz (%)" name="interestRate" type="number" />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Objektdetails</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Wohnflaeche (m2)" name="sqm" type="number" />
              <Field label="Baujahr" name="yearBuilt" type="number" />
            </div>
          </div>

          <Button type="submit" className="w-full">Aenderungen speichern</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditPropertyDialog;
