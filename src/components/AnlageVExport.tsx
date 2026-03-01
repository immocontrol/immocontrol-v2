import { useState, useMemo, useCallback } from "react";
import { FileText, Download, Calculator, Euro, TrendingDown, Building2, Receipt, Shield, Wrench, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/NumberInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProperties } from "@/context/PropertyContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import jsPDF from "jspdf";

/** Feature 4: Vollständiger Steuer-Export Anlage V */
export const AnlageVExport = () => {
  const { properties, stats } = useProperties();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [loading, setLoading] = useState(false);
  const [extras, setExtras] = useState({
    fahrtkosten: 0,
    fahrten: 0,
    kmPauschale: 0.30,
    hausverwaltung: 0,
    rechtsberatung: 0,
    kontoGebuehren: 0,
    renovierung: 0,
    gartenarbeit: 0,
    sonstiges: 0,
    sonstigesLabel: "",
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["anlage_v_loans", year],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("*");
      return data || [];
    },
    enabled: !!user && open,
  });

  const { data: insurances = [] } = useQuery({
    queryKey: ["anlage_v_insurances", year],
    queryFn: async () => {
      const { data } = await supabase.from("property_insurances").select("*");
      return data || [];
    },
    enabled: !!user && open,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["anlage_v_payments", year],
    queryFn: async () => {
      const { data } = await supabase
        .from("rent_payments")
        .select("*, tenants(first_name, last_name)")
        .gte("due_date", `${year}-01-01`)
        .lte("due_date", `${year}-12-31`)
        .eq("status", "confirmed");
      return data || [];
    },
    enabled: !!user && open,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["anlage_v_transactions", year],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_transactions")
        .select("*")
        .gte("booking_date", `${year}-01-01`)
        .lte("booking_date", `${year}-12-31`);
      return data || [];
    },
    enabled: !!user && open,
  });

  const anlageV = useMemo(() => {
    // Zeile 9: Mieteinnahmen
    const mieteinnahmen = payments.reduce((s: number, p: { amount: number | string }) => s + Number(p.amount), 0);

    // Zeile 13: Umlagen (approx from NK)
    const umlagen = properties.reduce((s, p) => s + p.monthlyExpenses * 12, 0);

    // Total income
    const einnahmenGesamt = mieteinnahmen + umlagen;

    // Werbungskosten
    // Zeile 33: AfA
    const afa = properties.reduce((s, p) => {
      const rate = (p.yearBuilt || 1970) >= 2023 ? 3 : 2;
      // 75% Gebäudeanteil * Kaufpreis * AfA-Satz
      return s + (p.purchasePrice * 0.75 * rate / 100);
    }, 0);

    // Zeile 37: Schuldzinsen
    const schuldzinsen = loans.reduce((s: number, l: { remaining_balance: number | string; interest_rate: number | string }) => {
      return s + (Number(l.remaining_balance) * Number(l.interest_rate) / 100);
    }, 0);

    // Zeile 46: Grundsteuer (estimated from transactions)
    const grundsteuer = transactions
      .filter((t: { reference?: string; booking_text?: string; amount: number }) => {
        const ref = ((t.reference || "") + " " + (t.booking_text || "")).toLowerCase();
        return ref.includes("grundsteuer") && t.amount < 0;
      })
      .reduce((s: number, t: { amount: number }) => s + Math.abs(t.amount), 0);

    // Zeile 47: Versicherungen
    const versicherungen = insurances.reduce((s: number, i: { annual_premium?: number | string }) => s + Number(i.annual_premium || 0), 0);

    // Zeile 48: Bewirtschaftungskosten
    const bewirtschaftung = umlagen;

    // Zeile 49: Instandhaltung (from transactions)
    const instandhaltung = transactions
      .filter((t: { reference?: string; booking_text?: string; amount: number }) => {
        const ref = ((t.reference || "") + " " + (t.booking_text || "")).toLowerCase();
        return (ref.includes("repar") || ref.includes("wartung") || ref.includes("handwerk") || ref.includes("instandh")) && t.amount < 0;
      })
      .reduce((s: number, t: { amount: number }) => s + Math.abs(t.amount), 0) + extras.renovierung;

    // Fahrtkosten
    const fahrtkosten = extras.fahrten * extras.kmPauschale * 2; // Hin- und Rückfahrt

    // Hausverwaltung
    const hausverwaltung = extras.hausverwaltung;

    // Sonstige Werbungskosten
    const sonstigeWK = extras.rechtsberatung + extras.kontoGebuehren + extras.gartenarbeit + extras.sonstiges;

    // Summe Werbungskosten
    const werbungskostenGesamt = afa + schuldzinsen + grundsteuer + versicherungen + bewirtschaftung + instandhaltung + fahrtkosten + hausverwaltung + sonstigeWK;

    // Einkünfte aus V+V
    const einkuenfteVV = einnahmenGesamt - werbungskostenGesamt;

    // Steuerersparnis
    const ersparnis42 = werbungskostenGesamt * 0.42;
    const ersparnis35 = werbungskostenGesamt * 0.35;

    return {
      mieteinnahmen, umlagen, einnahmenGesamt,
      afa, schuldzinsen, grundsteuer, versicherungen, bewirtschaftung,
      instandhaltung, fahrtkosten, hausverwaltung, sonstigeWK,
      werbungskostenGesamt, einkuenfteVV, ersparnis42, ersparnis35,
    };
  }, [properties, loans, insurances, payments, transactions, extras]);

  const generatePDF = useCallback(() => {
    setLoading(true);
    try {
      const doc = new jsPDF({ format: "a4" });
      const margin = 20;
      let y = margin;

      const addTitle = (text: string) => {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(text, margin, y);
        y += 10;
      };

      const addSection = (text: string) => {
        y += 4;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(60, 120, 80);
        doc.text(text, margin, y);
        doc.setTextColor(0);
        y += 7;
      };

      const addRow = (label: string, amount: number, zeile?: string, bold = false) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        const zPrefix = zeile ? `(Z. ${zeile}) ` : "";
        doc.text(`${zPrefix}${label}`, margin, y);
        const amountStr = formatCurrency(amount);
        doc.text(amountStr, 190 - doc.getTextWidth(amountStr), y);
        y += 6;
      };

      const addLine = () => {
        doc.setDrawColor(200);
        doc.line(margin, y - 2, 190, y - 2);
        y += 2;
      };

      // Header
      addTitle(`Anlage V – Einkünfte aus Vermietung und Verpachtung ${year}`);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")} · ${properties.length} Objekte`, margin, y);
      doc.setTextColor(0);
      y += 10;

      // Objekte
      addSection("Objekte");
      properties.forEach((p, i) => {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`${i + 1}. ${p.name} – ${p.address || "k.A."} (Baujahr ${p.yearBuilt || "k.A."}, ${p.sqm} m²)`, margin + 2, y);
        y += 5;
      });
      y += 3;

      // Einnahmen
      addSection("A. Einnahmen");
      addRow("Mieteinnahmen (Kaltmiete)", anlageV.mieteinnahmen, "9");
      addRow("Umlagen / Nebenkosten", anlageV.umlagen, "13");
      addLine();
      addRow("Einnahmen gesamt", anlageV.einnahmenGesamt, undefined, true);
      y += 4;

      // Werbungskosten
      addSection("B. Werbungskosten");
      addRow("AfA (Absetzung für Abnutzung)", anlageV.afa, "33");
      addRow("Schuldzinsen (Darlehenszinsen)", anlageV.schuldzinsen, "37");
      addRow("Grundsteuer", anlageV.grundsteuer, "46");
      addRow("Versicherungen", anlageV.versicherungen, "47");
      addRow("Bewirtschaftungskosten", anlageV.bewirtschaftung, "48");
      addRow("Instandhaltung / Renovierung", anlageV.instandhaltung, "49");
      addRow("Fahrtkosten", anlageV.fahrtkosten, "50");
      addRow("Hausverwaltung", anlageV.hausverwaltung, "51");
      addRow("Sonstige Werbungskosten", anlageV.sonstigeWK, "52");
      addLine();
      addRow("Werbungskosten gesamt", anlageV.werbungskostenGesamt, undefined, true);
      y += 6;

      // Ergebnis
      addSection("C. Ergebnis");
      addLine();
      addRow("Einkünfte aus V+V", anlageV.einkuenfteVV, undefined, true);
      y += 4;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Geschätzte Steuerersparnis bei 42%: ${formatCurrency(anlageV.ersparnis42)}`, margin, y);
      y += 5;
      doc.text(`Geschätzte Steuerersparnis bei 35%: ${formatCurrency(anlageV.ersparnis35)}`, margin, y);
      doc.setTextColor(0);

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("ImmoControl · Anlage V Übersicht · Keine Steuerberatung – bitte Steuerberater konsultieren", margin, 280);

      doc.save(`Anlage_V_${year}.pdf`);
      toast.success(`Anlage V für ${year} heruntergeladen`);
    } catch {
      toast.error("Fehler beim Erstellen der Anlage V");
    } finally {
      setLoading(false);
    }
  }, [year, properties, anlageV]);

  const generateCSV = useCallback(() => {
    const rows = [
      ["Anlage V", year.toString()],
      [],
      ["Position", "Zeile", "Betrag"],
      ["Mieteinnahmen", "9", anlageV.mieteinnahmen.toFixed(2)],
      ["Umlagen", "13", anlageV.umlagen.toFixed(2)],
      ["Einnahmen gesamt", "", anlageV.einnahmenGesamt.toFixed(2)],
      [],
      ["AfA", "33", anlageV.afa.toFixed(2)],
      ["Schuldzinsen", "37", anlageV.schuldzinsen.toFixed(2)],
      ["Grundsteuer", "46", anlageV.grundsteuer.toFixed(2)],
      ["Versicherungen", "47", anlageV.versicherungen.toFixed(2)],
      ["Bewirtschaftung", "48", anlageV.bewirtschaftung.toFixed(2)],
      ["Instandhaltung", "49", anlageV.instandhaltung.toFixed(2)],
      ["Fahrtkosten", "50", anlageV.fahrtkosten.toFixed(2)],
      ["Hausverwaltung", "51", anlageV.hausverwaltung.toFixed(2)],
      ["Sonstige WK", "52", anlageV.sonstigeWK.toFixed(2)],
      ["Werbungskosten gesamt", "", anlageV.werbungskostenGesamt.toFixed(2)],
      [],
      ["Einkuenfte aus V+V", "", anlageV.einkuenfteVV.toFixed(2)],
    ];

    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Anlage_V_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Anlage V CSV für ${year} heruntergeladen`);
  }, [year, anlageV]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Calculator className="h-3.5 w-3.5" /> Anlage V
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Anlage V – Einkünfte aus Vermietung & Verpachtung
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Year */}
          <div className="flex items-center gap-3">
            <Label className="text-xs shrink-0">Steuerjahr:</Label>
            <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2030} className="w-24 h-9 text-sm" />
          </div>

          {/* Einnahmen */}
          <div className="gradient-card rounded-xl border border-border p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Euro className="h-3.5 w-3.5" /> A. Einnahmen
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Z. 9 – Mieteinnahmen</span><span className="font-medium">{formatCurrency(anlageV.mieteinnahmen)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Z. 13 – Umlagen</span><span className="font-medium">{formatCurrency(anlageV.umlagen)}</span></div>
              <div className="flex justify-between border-t border-border pt-1.5 mt-1.5"><span className="font-semibold">Gesamt</span><span className="font-bold text-profit">{formatCurrency(anlageV.einnahmenGesamt)}</span></div>
            </div>
          </div>

          {/* Werbungskosten aus DB */}
          <div className="gradient-card rounded-xl border border-border p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" /> B. Werbungskosten (automatisch)
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Z. 33 – AfA</span><span className="font-medium">{formatCurrency(anlageV.afa)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Z. 37 – Schuldzinsen</span><span className="font-medium">{formatCurrency(anlageV.schuldzinsen)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Z. 46 – Grundsteuer</span><span className="font-medium">{formatCurrency(anlageV.grundsteuer)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Z. 47 – Versicherungen</span><span className="font-medium">{formatCurrency(anlageV.versicherungen)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Z. 48 – Bewirtschaftung</span><span className="font-medium">{formatCurrency(anlageV.bewirtschaftung)}</span></div>
            </div>
          </div>

          {/* Manual Werbungskosten */}
          <div className="gradient-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> B. Werbungskosten (manuell ergänzen)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Z. 49 – Renovierung €</Label>
                <NumberInput value={extras.renovierung} onChange={v => setExtras(e => ({ ...e, renovierung: v }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Anzahl Fahrten</Label>
                <NumberInput value={extras.fahrten} onChange={v => setExtras(e => ({ ...e, fahrten: v }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">km (einfach)</Label>
                <NumberInput value={extras.fahrtkosten} onChange={v => setExtras(e => ({ ...e, fahrtkosten: v }))} className="h-8 text-xs" decimals />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Z. 51 – Hausverwaltung €</Label>
                <NumberInput value={extras.hausverwaltung} onChange={v => setExtras(e => ({ ...e, hausverwaltung: v }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Rechtsberatung €</Label>
                <NumberInput value={extras.rechtsberatung} onChange={v => setExtras(e => ({ ...e, rechtsberatung: v }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Kontogebühren €</Label>
                <NumberInput value={extras.kontoGebuehren} onChange={v => setExtras(e => ({ ...e, kontoGebuehren: v }))} className="h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="gradient-card rounded-xl border border-primary/20 p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">C. Ergebnis</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Werbungskosten gesamt</span><span className="font-bold text-profit">{formatCurrency(anlageV.werbungskostenGesamt)}</span></div>
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="font-semibold text-base">Einkünfte aus V+V</span>
                <span className={`font-bold text-lg ${anlageV.einkuenfteVV <= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(anlageV.einkuenfteVV)}</span>
              </div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Geschätzte Ersparnis (42%)</span><span className="text-profit font-medium">{formatCurrency(anlageV.ersparnis42)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Geschätzte Ersparnis (35%)</span><span className="text-profit font-medium">{formatCurrency(anlageV.ersparnis35)}</span></div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={generatePDF} className="gap-2" disabled={loading || properties.length === 0}>
              <FileText className="h-4 w-4" /> Als PDF
            </Button>
            <Button variant="outline" onClick={generateCSV} className="gap-2" disabled={loading || properties.length === 0}>
              <Download className="h-4 w-4" /> Als CSV
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Hinweis: Dies ist eine Übersicht, keine Steuerberatung. Bitte Steuerberater für die offizielle Anlage V konsultieren.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
