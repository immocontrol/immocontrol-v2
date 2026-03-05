/**
 * INHALT-2: Steuer-Jahresabschluss — Automatische Anlage V Zusammenfassung
 * Für jedes Steuerjahr alle Einnahmen, Werbungskosten, AfA, Zinsen pro Objekt zusammenfassen.
 * Export als PDF für den Steuerberater.
 */
import { memo, useMemo, useState } from "react";
import { FileText, Download, Calculator, ChevronDown, ChevronUp, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatPercentDE } from "@/lib/formatters";
import { toast } from "sonner";

interface PropertyTaxSummary {
  propertyId: string;
  name: string;
  location: string;
  mieteinnahmen: number;
  nebenkosten: number;
  zinsen: number;
  tilgung: number;
  afa: number;
  instandhaltung: number;
  verwaltung: number;
  werbungskosten: number;
  zuVersteuern: number;
  steuerersparnis: number;
}

const SteuerJahresabschluss = memo(() => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [expanded, setExpanded] = useState(false);
  const [taxRate, setTaxRate] = useState(42);

  const { data: loans = [] } = useQuery({
    queryKey: ["steuer_loans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("id, remaining_balance, interest_rate, monthly_payment, property_id");
      return (data || []) as Array<{
        id: string;
        remaining_balance: number;
        interest_rate: number;
        monthly_payment: number;
        property_id: string;
      }>;
    },
    enabled: !!user,
  });

  const taxSummaries = useMemo((): PropertyTaxSummary[] => {
    return properties.map((p) => {
      const propertyLoans = loans.filter((l) => l.property_id === p.id);
      const annualRent = p.monthlyRent * 12;
      const annualExpenses = p.monthlyExpenses * 12;

      // Calculate interest portion of loan payments
      const annualInterest = propertyLoans.reduce((sum, l) => {
        return sum + (l.remaining_balance * l.interest_rate / 100);
      }, 0);
      const annualTilgung = propertyLoans.reduce((sum, l) => {
        return sum + Math.max(0, l.monthly_payment * 12 - (l.remaining_balance * l.interest_rate / 100));
      }, 0);

      // AfA: 2% for buildings after 1925, 2.5% before 1925, 3% for new (after 2023, §7 Abs. 4 EStG)
      const buildingValue = p.purchasePrice * 0.75; // ~75% building
      let afaRate = 0.02;
      if (p.yearBuilt && p.yearBuilt < 1925) afaRate = 0.025;
      if (p.yearBuilt && p.yearBuilt >= 2023) afaRate = 0.03;
      const afa = buildingValue * afaRate;

      // Estimated maintenance & management costs
      const instandhaltung = annualExpenses * 0.4;
      const verwaltung = annualExpenses * 0.2;

      const werbungskosten = annualInterest + afa + instandhaltung + verwaltung + annualExpenses * 0.4;
      const zuVersteuern = Math.max(0, annualRent - werbungskosten);
      const steuerersparnis = werbungskosten > annualRent ? (werbungskosten - annualRent) * (taxRate / 100) : 0;

      return {
        propertyId: p.id,
        name: p.name,
        location: p.location,
        mieteinnahmen: annualRent,
        nebenkosten: annualExpenses,
        zinsen: annualInterest,
        tilgung: annualTilgung,
        afa,
        instandhaltung,
        verwaltung,
        werbungskosten,
        zuVersteuern,
        steuerersparnis,
      };
    });
  }, [properties, loans, taxRate]);

  const totals = useMemo(() => {
    return taxSummaries.reduce(
      (acc, s) => ({
        mieteinnahmen: acc.mieteinnahmen + s.mieteinnahmen,
        werbungskosten: acc.werbungskosten + s.werbungskosten,
        zinsen: acc.zinsen + s.zinsen,
        afa: acc.afa + s.afa,
        zuVersteuern: acc.zuVersteuern + s.zuVersteuern,
        steuerersparnis: acc.steuerersparnis + s.steuerersparnis,
      }),
      { mieteinnahmen: 0, werbungskosten: 0, zinsen: 0, afa: 0, zuVersteuern: 0, steuerersparnis: 0 },
    );
  }, [taxSummaries]);

  const handleExportCSV = () => {
    const headers = "Objekt;Ort;Mieteinnahmen;Zinsen;AfA;Instandhaltung;Verwaltung;Werbungskosten;Zu versteuern;Steuerersparnis\n";
    const rows = taxSummaries.map((s) =>
      `${s.name};${s.location};${s.mieteinnahmen.toFixed(2)};${s.zinsen.toFixed(2)};${s.afa.toFixed(2)};${s.instandhaltung.toFixed(2)};${s.verwaltung.toFixed(2)};${s.werbungskosten.toFixed(2)};${s.zuVersteuern.toFixed(2)};${s.steuerersparnis.toFixed(2)}`
    ).join("\n");
    const totalRow = `\nGESAMT;;;${totals.zinsen.toFixed(2)};${totals.afa.toFixed(2)};;;${totals.werbungskosten.toFixed(2)};${totals.zuVersteuern.toFixed(2)};${totals.steuerersparnis.toFixed(2)}`;
    const blob = new Blob(["\uFEFF" + headers + rows + totalRow], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `steuer-jahresabschluss-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Steuer-Jahresabschluss ${selectedYear} exportiert`);
  };

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Steuer-Jahresabschluss</h3>
        </div>
        <div className="flex items-center gap-1">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-6 w-20 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[10px] text-muted-foreground">Mieteinnahmen</p>
          <p className="text-xs font-bold text-profit">{formatCurrency(totals.mieteinnahmen)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[10px] text-muted-foreground">Werbungskosten</p>
          <p className="text-xs font-bold text-primary">{formatCurrency(totals.werbungskosten)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[10px] text-muted-foreground">Zu versteuern</p>
          <p className="text-xs font-bold">{formatCurrency(totals.zuVersteuern)}</p>
        </div>
      </div>

      {/* Tax savings highlight */}
      {totals.steuerersparnis > 0 && (
        <div className="p-2 rounded-lg bg-profit/5 border border-profit/20 text-center mb-3">
          <p className="text-[10px] text-muted-foreground">Steuerersparnis durch Immobilien</p>
          <p className="text-sm font-bold text-profit">{formatCurrency(totals.steuerersparnis)}</p>
          <p className="text-[10px] text-muted-foreground">bei {taxRate}% Grenzsteuersatz</p>
        </div>
      )}

      {/* Breakdown per object */}
      <div className="grid grid-cols-2 gap-1 text-[10px] mb-3">
        <div className="flex items-center gap-1">
          <Calculator className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">AfA gesamt:</span>
          <span className="font-medium">{formatCurrency(totals.afa)}</span>
        </div>
        <div className="flex items-center gap-1">
          <CreditCard className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Zinsen gesamt:</span>
          <span className="font-medium">{formatCurrency(totals.zinsen)}</span>
        </div>
      </div>

      {/* Expanded: Per-property details */}
      {expanded && (
        <div className="border-t border-border pt-3 space-y-2">
          {taxSummaries.map((s) => (
            <div key={s.propertyId} className="p-2 rounded-lg bg-background/50 border border-border/50">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium">{s.name}</span>
                </div>
                {s.steuerersparnis > 0 && (
                  <Badge variant="outline" className="text-[10px] text-profit">{formatCurrency(s.steuerersparnis)} Ersparnis</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div>
                  <span className="text-muted-foreground">Miete</span>
                  <p className="font-medium text-profit">{formatCurrency(s.mieteinnahmen)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">AfA</span>
                  <p className="font-medium">{formatCurrency(s.afa)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Zinsen</span>
                  <p className="font-medium">{formatCurrency(s.zinsen)}</p>
                </div>
              </div>
            </div>
          ))}

          <Button size="sm" variant="outline" className="w-full text-[10px] h-7 mt-2" onClick={handleExportCSV}>
            <Download className="h-3 w-3 mr-1" />
            CSV für Steuerberater exportieren
          </Button>
        </div>
      )}
    </div>
  );
});
SteuerJahresabschluss.displayName = "SteuerJahresabschluss";

export { SteuerJahresabschluss };
