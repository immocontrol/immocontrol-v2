import { useState } from "react";
import { Calculator, TrendingUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";

interface RentIncreaseCalculatorProps {
  currentRent: number;
  propertyName?: string;
}

const RentIncreaseCalculator = ({ currentRent, propertyName }: RentIncreaseCalculatorProps) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    currentRent,
    targetPercent: 15,
    mietspiegel: 0,
    lastIncrease: "",
  });

  const maxLegal = Math.min(form.targetPercent, 20);
  const absoluteIncrease = (form.currentRent * maxLegal) / 100;
  const newRent = form.currentRent + absoluteIncrease;
  const yearlyGain = absoluteIncrease * 12;

  const mietspiegelOk = form.mietspiegel === 0 || newRent <= form.mietspiegel * 1.1;

  const canRaiseDate = form.lastIncrease
    ? new Date(form.lastIncrease) <= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    : true;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
          <Calculator className="h-3.5 w-3.5" /> Mieterhöhung
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Mieterhöhungsrechner
          </DialogTitle>
          {propertyName && <p className="text-xs text-muted-foreground">{propertyName}</p>}
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Aktuelle Miete</Label>
              <NumberInput value={form.currentRent} onChange={v => setForm(f => ({ ...f, currentRent: v }))} className="h-9 text-sm" decimals />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs">Erhöhung %</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px] text-xs">
                      Gem. §558 BGB max. 20% in 3 Jahren (Kappungsgrenze). In vielen Städten max. 15%.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <NumberInput value={form.targetPercent} onChange={v => setForm(f => ({ ...f, targetPercent: Math.min(v, 20) }))} className="h-9 text-sm" decimals />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mietspiegel (€/Monat)</Label>
              <NumberInput value={form.mietspiegel} onChange={v => setForm(f => ({ ...f, mietspiegel: v }))} className="h-9 text-sm" placeholder="0 = nicht bekannt" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Letzte Erhöhung</Label>
              <input type="date" value={form.lastIncrease} onChange={e => setForm(f => ({ ...f, lastIncrease: e.target.value }))} className="h-9 text-sm w-full rounded-md border border-input bg-background px-3 py-1" />
            </div>
          </div>

          <div className="gradient-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Neue Miete</span>
              <span className="font-bold text-primary">{formatCurrency(newRent)}/Monat</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Erhöhungsbetrag</span>
              <span className="font-medium text-profit">+{formatCurrency(absoluteIncrease)}/Monat</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mehrertrag/Jahr</span>
              <span className="font-medium text-profit">+{formatCurrency(yearlyGain)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${canRaiseDate ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
              <span className="font-medium">
                {canRaiseDate ? "Zeitlich zulässig" : "Wartezeit: mind. 12 Monate seit letzter Erhöhung"}
              </span>
            </div>
            {form.mietspiegel > 0 && (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${mietspiegelOk ? "bg-profit/10 text-profit" : "bg-gold/10 text-gold"}`}>
                <span className="font-medium">
                  {mietspiegelOk ? "Innerhalb der Mietspiegel-Grenze" : "Achtung: ggf. über ortsüblicher Vergleichsmiete"}
                </span>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Hinweis: Dies ist eine Orientierungshilfe. Für rechtsverbindliche Auskunft bitte Fachanwalt konsultieren. §558 BGB Kappungsgrenze beachten.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RentIncreaseCalculator;
