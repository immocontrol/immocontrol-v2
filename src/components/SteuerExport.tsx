/**
 * #19: Steuer-Jahresübersicht mit Anlage V — Tax year export for ELSTER.
 * Generates a summary of rental income and deductible expenses per property
 * in Anlage V format, exportable as CSV for tax filing.
 */
import { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

interface Property {
  id: string;
  name: string;
  address: string;
  monthlyRent: number;
  monthlyExpenses: number;
  remainingDebt: number;
  interestRate: number;
  purchasePrice: number;
  currentValue: number;
  sqm: number;
}

interface SteuerExportProps {
  properties: Property[];
  year?: number;
}

interface AnlageVEntry {
  propertyName: string;
  address: string;
  /** Zeile 9: Mieteinnahmen (Brutto-Jahresmiete) */
  mieteinnahmen: number;
  /** Zeile 31: AfA (Abschreibung — 2% of purchase price for buildings) */
  afa: number;
  /** Zeile 37: Schuldzinsen (annual interest payments) */
  schuldzinsen: number;
  /** Zeile 46: Betriebskosten (annual operating expenses) */
  betriebskosten: number;
  /** Zeile 50: Erhaltungsaufwendungen (estimated) */
  erhaltung: number;
  /** Werbungskosten gesamt */
  werbungskostenGesamt: number;
  /** Einkünfte aus V+V (Einnahmen - Werbungskosten) */
  einkuenfteVV: number;
}

export function SteuerExport({ properties, year = new Date().getFullYear() - 1 }: SteuerExportProps) {
  const entries = useMemo((): AnlageVEntry[] => {
    return properties.map((p) => {
      const mieteinnahmen = p.monthlyRent * 12;
      // AfA: 2% of purchase price (standard for buildings built after 1924)
      const afa = p.purchasePrice * 0.02;
      // Annual interest: approximate from remaining debt * interest rate
      const schuldzinsen = p.remainingDebt * (p.interestRate / 100);
      // Operating expenses
      const betriebskosten = p.monthlyExpenses * 12;
      // Maintenance reserve: ~1% of current value
      const erhaltung = p.currentValue * 0.01;
      const werbungskostenGesamt = afa + schuldzinsen + betriebskosten + erhaltung;
      const einkuenfteVV = mieteinnahmen - werbungskostenGesamt;

      return {
        propertyName: p.name,
        address: p.address || "–",
        mieteinnahmen,
        afa,
        schuldzinsen,
        betriebskosten,
        erhaltung,
        werbungskostenGesamt,
        einkuenfteVV,
      };
    });
  }, [properties]);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, e) => ({
        mieteinnahmen: acc.mieteinnahmen + e.mieteinnahmen,
        afa: acc.afa + e.afa,
        schuldzinsen: acc.schuldzinsen + e.schuldzinsen,
        betriebskosten: acc.betriebskosten + e.betriebskosten,
        erhaltung: acc.erhaltung + e.erhaltung,
        werbungskostenGesamt: acc.werbungskostenGesamt + e.werbungskostenGesamt,
        einkuenfteVV: acc.einkuenfteVV + e.einkuenfteVV,
      }),
      { mieteinnahmen: 0, afa: 0, schuldzinsen: 0, betriebskosten: 0, erhaltung: 0, werbungskostenGesamt: 0, einkuenfteVV: 0 }
    );
  }, [entries]);

  const exportCSV = useCallback(() => {
    if (entries.length === 0) {
      toast.error("Keine Objekte vorhanden");
      return;
    }

    const header = "Objekt;Adresse;Mieteinnahmen;AfA (2%);Schuldzinsen;Betriebskosten;Erhaltung;Werbungskosten Gesamt;Einkünfte V+V";
    const rows = entries.map((e) =>
      [
        e.propertyName,
        e.address,
        e.mieteinnahmen.toFixed(2),
        e.afa.toFixed(2),
        e.schuldzinsen.toFixed(2),
        e.betriebskosten.toFixed(2),
        e.erhaltung.toFixed(2),
        e.werbungskostenGesamt.toFixed(2),
        e.einkuenfteVV.toFixed(2),
      ].join(";")
    );

    const totalRow = [
      "GESAMT",
      "",
      totals.mieteinnahmen.toFixed(2),
      totals.afa.toFixed(2),
      totals.schuldzinsen.toFixed(2),
      totals.betriebskosten.toFixed(2),
      totals.erhaltung.toFixed(2),
      totals.werbungskostenGesamt.toFixed(2),
      totals.einkuenfteVV.toFixed(2),
    ].join(";");

    const csv = [header, ...rows, "", totalRow].join("\n");
    const bom = "\uFEFF"; // UTF-8 BOM for Excel
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AnlageV_${year}_ImmoControl.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Anlage V Export für ${year} erstellt`);
  }, [entries, totals, year]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Steuer-Jahresübersicht {year}</h3>
          <p className="text-xs text-muted-foreground">Anlage V — Einkünfte aus Vermietung und Verpachtung</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCSV} disabled={entries.length === 0}>
          <FileSpreadsheet className="h-3.5 w-3.5" />
          CSV Export
        </Button>
      </div>

      {entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-secondary/30">
                <th className="text-left p-2 font-medium">Objekt</th>
                <th className="text-right p-2 font-medium">Miete/J</th>
                <th className="text-right p-2 font-medium">AfA</th>
                <th className="text-right p-2 font-medium">Zinsen</th>
                <th className="text-right p-2 font-medium">Betriebsk.</th>
                <th className="text-right p-2 font-medium">Einkünfte</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-2">{e.propertyName}</td>
                  <td className="p-2 text-right">{formatCurrency(e.mieteinnahmen)}</td>
                  <td className="p-2 text-right">{formatCurrency(e.afa)}</td>
                  <td className="p-2 text-right">{formatCurrency(e.schuldzinsen)}</td>
                  <td className="p-2 text-right">{formatCurrency(e.betriebskosten)}</td>
                  <td className={`p-2 text-right font-medium ${e.einkuenfteVV >= 0 ? "text-profit" : "text-loss"}`}>
                    {formatCurrency(e.einkuenfteVV)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold border-t-2 border-foreground/20">
                <td className="p-2">Gesamt</td>
                <td className="p-2 text-right">{formatCurrency(totals.mieteinnahmen)}</td>
                <td className="p-2 text-right">{formatCurrency(totals.afa)}</td>
                <td className="p-2 text-right">{formatCurrency(totals.schuldzinsen)}</td>
                <td className="p-2 text-right">{formatCurrency(totals.betriebskosten)}</td>
                <td className={`p-2 text-right ${totals.einkuenfteVV >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatCurrency(totals.einkuenfteVV)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
