import { useMemo } from "react";
import { Lightbulb, Euro, TrendingDown, Receipt, Calculator } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { getAnnualAfa } from "@/lib/afaSanierung";

const SteuerHelfer = () => {
  const { properties, stats } = useProperties();
  const { user } = useAuth();

  const { data: loans = [] } = useQuery({
    queryKey: ["steuer_loans"],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: insurances = [] } = useQuery({
    queryKey: ["steuer_insurances"],
    queryFn: async () => {
      const { data } = await supabase.from("property_insurances").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const steuerData = useMemo(() => {
    // Annual rental income
    const annualRent = stats.totalRent * 12;
    
    // AfA: Gebäudeanteil + Restnutzungsdauer oder AfA-Satz
    const totalAfa = properties.reduce((s, p) => s + getAnnualAfa({ purchasePrice: p.purchasePrice, yearBuilt: p.yearBuilt, buildingSharePercent: p.buildingSharePercent, restnutzungsdauer: p.restnutzungsdauer }), 0);

    // Interest payments (deductible)
    const totalInterest = loans.reduce((s, l) => {
      return s + (Number(l.remaining_balance) * Number(l.interest_rate) / 100);
    }, 0);

    // Operating expenses
    const totalExpenses = properties.reduce((s, p) => s + p.monthlyExpenses * 12, 0);

    // Insurance premiums
    const totalInsurance = insurances.reduce((s, i) => s + Number(i.annual_premium || 0), 0);

    // Total deductions
    const totalDeductions = totalAfa + totalInterest + totalExpenses + totalInsurance;

    // Taxable income from real estate
    const taxableIncome = annualRent - totalDeductions;

    // Estimated tax savings at different rates
    const savings42 = totalDeductions * 0.42;
    const savings35 = totalDeductions * 0.35;

    // Tips
    const tips: { icon: typeof Euro; text: string; priority: "high" | "medium" | "low" }[] = [];
    
    if (totalAfa === 0 && properties.length > 0) {
      tips.push({ icon: TrendingDown, text: "AfA wird noch nicht genutzt – prüfe die Gebäude-Abschreibung!", priority: "high" });
    }
    if (totalInterest > annualRent * 0.3) {
      tips.push({ icon: Euro, text: "Zinslast ist hoch (>30% der Miete) – Umschuldung prüfen", priority: "medium" });
    }
    if (totalInsurance === 0 && properties.length > 0) {
      tips.push({ icon: Receipt, text: "Keine Versicherungen erfasst – Prämien sind steuerlich absetzbar", priority: "medium" });
    }
    if (taxableIncome > 0) {
      tips.push({ icon: Calculator, text: `${formatCurrency(taxableIncome)} zu versteuern – Renovierungen vor Jahresende prüfen`, priority: "low" });
    }

    return { annualRent, totalAfa, totalInterest, totalExpenses, totalInsurance, totalDeductions, taxableIncome, savings42, tips };
  }, [properties, stats, loans, insurances]);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5 space-y-4 animate-fade-in">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-gold" /> Steuer-Helfer
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase">Mieteinnahmen/J</div>
          <div className="text-sm font-bold">{formatCurrency(steuerData.annualRent)}</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase">Absetzbar/J</div>
          <div className="text-sm font-bold text-profit">{formatCurrency(steuerData.totalDeductions)}</div>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">AfA (Abschreibung)</span><span className="font-medium">{formatCurrency(steuerData.totalAfa)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Darlehenszinsen</span><span className="font-medium">{formatCurrency(steuerData.totalInterest)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Bewirtschaftung</span><span className="font-medium">{formatCurrency(steuerData.totalExpenses)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Versicherungen</span><span className="font-medium">{formatCurrency(steuerData.totalInsurance)}</span></div>
        <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
          <span className="font-semibold">Zu versteuern</span>
          <span className={`font-bold ${steuerData.taxableIncome <= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(steuerData.taxableIncome)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Geschätzte Ersparnis (42%)</span>
          <span className="font-bold text-profit">{formatCurrency(steuerData.savings42)}</span>
        </div>
      </div>

      {steuerData.tips.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">💡 Tipps</p>
          {steuerData.tips.map((tip, i) => (
            <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
              tip.priority === "high" ? "bg-loss/10 border border-loss/20" : "bg-secondary/50"
            }`}>
              <tip.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span>{tip.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SteuerHelfer;
