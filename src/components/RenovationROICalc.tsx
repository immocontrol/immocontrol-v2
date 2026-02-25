import { useState } from "react";
import { Hammer, TrendingUp, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const RENOVATION_TYPES = [
  { label: "Badezimmer", cost: 15000, rentIncrease: 80, valueIncrease: 8 },
  { label: "Küche", cost: 10000, rentIncrease: 50, valueIncrease: 5 },
  { label: "Fenster", cost: 8000, rentIncrease: 30, valueIncrease: 4 },
  { label: "Heizung", cost: 12000, rentIncrease: 40, valueIncrease: 6 },
  { label: "Dach", cost: 25000, rentIncrease: 20, valueIncrease: 10 },
  { label: "Fassade/Dämmung", cost: 20000, rentIncrease: 60, valueIncrease: 12 },
  { label: "Bodenbelag", cost: 5000, rentIncrease: 30, valueIncrease: 3 },
  { label: "Balkon", cost: 8000, rentIncrease: 40, valueIncrease: 4 },
];

const RenovationROICalc = () => {
  const [selected, setSelected] = useState<number[]>([]);
  const [customCost, setCustomCost] = useState(0);
  const [customRentIncrease, setCustomRentIncrease] = useState(0);

  const totalCost = selected.reduce((s, i) => s + RENOVATION_TYPES[i].cost, 0) + customCost;
  const totalRentIncrease = selected.reduce((s, i) => s + RENOVATION_TYPES[i].rentIncrease, 0) + customRentIncrease;
  const annualReturn = totalRentIncrease * 12;
  const roi = totalCost > 0 ? (annualReturn / totalCost) * 100 : 0;
  const paybackYears = annualReturn > 0 ? totalCost / annualReturn : 0;

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Hammer className="h-4 w-4 text-muted-foreground" /> Sanierung-ROI-Rechner
      </h3>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {RENOVATION_TYPES.map((r, i) => (
          <button
            key={i}
            onClick={() => setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
            className={`text-xs p-2 rounded-lg text-left transition-colors ${
              selected.includes(i) ? "bg-primary/10 border border-primary/30" : "bg-secondary/30 border border-transparent hover:bg-secondary/50"
            }`}
          >
            <div className="font-medium">{r.label}</div>
            <div className="text-[10px] text-muted-foreground">~{formatCurrency(r.cost)} · +{r.rentIncrease}€/M</div>
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2 rounded-lg bg-secondary/50 text-center">
              <p className="text-[10px] text-muted-foreground">Investition</p>
              <p className="font-bold text-loss">{formatCurrency(totalCost)}</p>
            </div>
            <div className="p-2 rounded-lg bg-profit/10 text-center">
              <p className="text-[10px] text-muted-foreground">Mietplus/M</p>
              <p className="font-bold text-profit">+{formatCurrency(totalRentIncrease)}</p>
            </div>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">ROI</span>
            <span className={`font-semibold ${roi >= 8 ? "text-profit" : roi >= 4 ? "text-gold" : "text-loss"}`}>{roi.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Amortisation</span>
            <span className="font-semibold">{paybackYears.toFixed(1)} Jahre</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RenovationROICalc;