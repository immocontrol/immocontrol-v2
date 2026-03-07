/**
 * IMP20-4: Deal → Immobilie Konvertierung
 * One-click conversion from Deal (status="abgeschlossen") to new Property.
 * Pre-fills address, price, sqm from deal fields.
 */
import { memo, useState } from "react";
import { Building2, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProperties } from "@/context/PropertyContext";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { handleError } from "@/lib/handleError";
import { toastErrorWithRetry } from "@/lib/toastMessages";

interface DealData {
  id: string;
  title: string;
  address?: string;
  purchase_price?: number;
  expected_rent?: number;
  sqm?: number;
  units?: number;
  property_type?: string;
}

interface DealToPropertyConverterProps {
  deal: DealData;
  onConverted?: () => void;
}

const DealToPropertyConverter = memo(({ deal, onConverted }: DealToPropertyConverterProps) => {
  const { addProperty } = useProperties();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: deal.title || "",
    address: deal.address || "",
    location: deal.address?.split(",").pop()?.trim() || "",
    purchasePrice: deal.purchase_price || 0,
    monthlyRent: deal.expected_rent || 0,
    sqm: deal.sqm || 0,
    units: deal.units || 1,
    type: deal.property_type || "ETW",
  });

  const handleConvert = async () => {
    setLoading(true);
    try {
      await addProperty({
        name: form.name,
        address: form.address,
        location: form.location,
        type: form.type,
        units: form.units,
        purchasePrice: form.purchasePrice,
        purchaseDate: new Date().toISOString().slice(0, 10),
        currentValue: form.purchasePrice,
        monthlyRent: form.monthlyRent,
        monthlyExpenses: 0,
        monthlyCreditRate: 0,
        monthlyCashflow: form.monthlyRent,
        remainingDebt: 0,
        interestRate: 0,
        sqm: form.sqm,
        yearBuilt: new Date().getFullYear(),
        ownership: "privat" as const,
      });
      toast.success(`Deal "${deal.title}" in Immobilie konvertiert`);
      setOpen(false);
      onConverted?.();
    } catch (e: unknown) {
      handleError(e, { context: "supabase", details: "deal-to-property", showToast: false });
      toastErrorWithRetry("Konvertierung fehlgeschlagen", handleConvert);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs text-profit border-profit/30 hover:bg-profit/10"
        onClick={() => setOpen(true)}
      >
        <Building2 className="h-3.5 w-3.5" />
        <ArrowRight className="h-3 w-3" />
        Als Immobilie anlegen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Deal → Immobilie konvertieren
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs">
              <p className="font-medium mb-1">Aus Deal übernommen:</p>
              <p>Titel: {deal.title}</p>
              {deal.purchase_price ? <p>Kaufpreis: {formatCurrency(deal.purchase_price)}</p> : null}
              {deal.sqm ? <p>Fläche: {deal.sqm} m²</p> : null}
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Adresse</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kaufpreis (€)</Label>
                <Input type="number" value={form.purchasePrice || ""} onChange={e => setForm(p => ({ ...p, purchasePrice: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs">Monatliche Miete (€)</Label>
                <Input type="number" value={form.monthlyRent || ""} onChange={e => setForm(p => ({ ...p, monthlyRent: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Fläche (m²)</Label>
                <Input type="number" value={form.sqm || ""} onChange={e => setForm(p => ({ ...p, sqm: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs">Einheiten</Label>
                <Input type="number" value={form.units || ""} onChange={e => setForm(p => ({ ...p, units: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label className="text-xs">Typ</Label>
                <Input value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} />
              </div>
            </div>
            <Button onClick={handleConvert} disabled={loading || !form.name.trim()} className="w-full gap-2">
              {loading ? "Konvertiere..." : <><Check className="h-4 w-4" /> Als Immobilie anlegen</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
DealToPropertyConverter.displayName = "DealToPropertyConverter";

export { DealToPropertyConverter };
