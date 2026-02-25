import { useState, useEffect, useCallback } from "react";
import { FileBarChart, Download, Building2, Users, Landmark, Calendar } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

const Berichte = () => {
  const { properties, stats } = useProperties();
  const { user } = useAuth();
  const [reportType, setReportType] = useState("portfolio");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());

  useEffect(() => { document.title = "Berichte-Center – ImmoControl"; }, []);

  const { data: tenants = [] } = useQuery({
    queryKey: ["berichte_tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*").eq("is_active", true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["berichte_loans"],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["berichte_payments"],
    queryFn: async () => {
      const { data } = await supabase.from("rent_payments").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  // DATEV Export
  const exportDATEV = useCallback(() => {
    if (properties.length === 0) return;
    const headers = ["Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Buchungstext"];
    const rows: string[][] = [];

    properties.forEach(p => {
      // Monthly rent income
      for (let m = 1; m <= 12; m++) {
        rows.push([
          p.monthlyRent.toFixed(2).replace(".", ","), "H", "EUR",
          "8400", "1200", "", `${m.toString().padStart(2, "0")}01${year.slice(-2)}`,
          p.name, `Mieteinnahme ${p.name}`
        ]);
      }
      // Monthly expenses
      if (p.monthlyExpenses > 0) {
        for (let m = 1; m <= 12; m++) {
          rows.push([
            p.monthlyExpenses.toFixed(2).replace(".", ","), "S", "EUR",
            "4200", "1200", "", `${m.toString().padStart(2, "0")}01${year.slice(-2)}`,
            p.name, `Bewirtschaftungskosten ${p.name}`
          ]);
        }
      }
    });

    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DATEV_Export_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("DATEV-Export erstellt!");
  }, [properties, year]);

  // Mietbericht
  const exportMietbericht = useCallback(() => {
    const prop = selectedProperty ? properties.find(p => p.id === selectedProperty) : null;
    const relevantTenants = selectedProperty ? tenants.filter(t => t.property_id === selectedProperty) : tenants;
    const relevantPayments = payments.filter(p => {
      const date = new Date(p.due_date);
      return date.getFullYear().toString() === year && (!selectedProperty || p.property_id === selectedProperty);
    });

    const totalDue = relevantPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalPaid = relevantPayments.filter(p => p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0);

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Mietbericht ${year}</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto}
h1{font-size:22px;border-bottom:2px solid #2a9d6e;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
th{background:#f5f5f5}
.positive{color:#2a9d6e}.negative{color:#d94040}
.summary{display:flex;gap:20px;margin:16px 0}
.stat{background:#f9f9f9;padding:14px;border-radius:8px;flex:1}
.stat-label{font-size:11px;text-transform:uppercase;color:#888}
.stat-value{font-size:20px;font-weight:700;margin-top:4px}</style></head><body>
<h1>📊 Mietbericht ${year}</h1>
${prop ? `<p><strong>Objekt:</strong> ${prop.name} · ${prop.address}</p>` : `<p><strong>Gesamtes Portfolio</strong> · ${properties.length} Objekte</p>`}
<div class="summary">
<div class="stat"><div class="stat-label">Soll-Miete</div><div class="stat-value">${formatCurrency(totalDue)}</div></div>
<div class="stat"><div class="stat-label">Ist-Miete</div><div class="stat-value class="positive"">${formatCurrency(totalPaid)}</div></div>
<div class="stat"><div class="stat-label">Aktive Mieter</div><div class="stat-value">${relevantTenants.length}</div></div>
</div>
<table><tr><th>Mieter</th><th>Objekt</th><th>Miete/M</th><th>Einzug</th></tr>
${relevantTenants.map(t => {
  const p = properties.find(pr => pr.id === t.property_id);
  return `<tr><td>${t.first_name} ${t.last_name}</td><td>${p?.name || "–"}</td><td>${formatCurrency(Number(t.monthly_rent || 0))}</td><td>${t.move_in_date ? new Date(t.move_in_date).toLocaleDateString("de-DE") : "–"}</td></tr>`;
}).join("")}
</table>
<p style="font-size:11px;color:#aaa;margin-top:40px;text-align:center">ImmoControl · Mietbericht · ${new Date().toLocaleDateString("de-DE")}</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    toast.success("Mietbericht erstellt");
  }, [properties, tenants, payments, selectedProperty, year]);

  // Objektbericht
  const exportObjektbericht = useCallback(() => {
    const prop = selectedProperty ? properties.find(p => p.id === selectedProperty) : null;
    if (!prop) { toast.error("Bitte Objekt wählen"); return; }
    const propLoans = loans.filter(l => l.property_id === prop.id);
    const propTenants = tenants.filter(t => t.property_id === prop.id);
    const bruttoRendite = prop.purchasePrice > 0 ? ((prop.monthlyRent * 12) / prop.purchasePrice * 100) : 0;

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Objektbericht – ${prop.name}</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto}
h1{font-size:22px;border-bottom:2px solid #2a9d6e;padding-bottom:8px}h2{font-size:16px;margin-top:24px;color:#555}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}th{background:#f5f5f5}
.positive{color:#2a9d6e}.negative{color:#d94040}</style></head><body>
<h1>🏠 Objektbericht – ${prop.name}</h1>
<p>${prop.address} · ${prop.type} · ${prop.units} Einheiten · ${prop.sqm} m² · Baujahr ${prop.yearBuilt}</p>
<h2>Finanzen</h2>
<table>
<tr><td>Kaufpreis</td><td>${formatCurrency(prop.purchasePrice)}</td></tr>
<tr><td>Aktueller Wert</td><td>${formatCurrency(prop.currentValue)}</td></tr>
<tr><td>Wertzuwachs</td><td class="${prop.currentValue >= prop.purchasePrice ? "positive" : "negative"}">${((prop.currentValue - prop.purchasePrice) / prop.purchasePrice * 100).toFixed(1)}%</td></tr>
<tr><td>Miete/Monat</td><td>${formatCurrency(prop.monthlyRent)}</td></tr>
<tr><td>Cashflow/Monat</td><td class="${prop.monthlyCashflow >= 0 ? "positive" : "negative"}">${formatCurrency(prop.monthlyCashflow)}</td></tr>
<tr><td>Brutto-Rendite</td><td>${bruttoRendite.toFixed(1)}%</td></tr>
<tr><td>Restschuld</td><td>${formatCurrency(prop.remainingDebt)}</td></tr>
</table>
${propLoans.length > 0 ? `<h2>Darlehen</h2><table><tr><th>Bank</th><th>Betrag</th><th>Restschuld</th><th>Zins</th><th>Rate/M</th></tr>
${propLoans.map(l => `<tr><td>${l.bank_name}</td><td>${formatCurrency(Number(l.loan_amount))}</td><td>${formatCurrency(Number(l.remaining_balance))}</td><td>${Number(l.interest_rate).toFixed(2)}%</td><td>${formatCurrency(Number(l.monthly_payment))}</td></tr>`).join("")}
</table>` : ""}
${propTenants.length > 0 ? `<h2>Mieter</h2><table><tr><th>Name</th><th>Miete</th><th>Einzug</th><th>Einheit</th></tr>
${propTenants.map(t => `<tr><td>${t.first_name} ${t.last_name}</td><td>${formatCurrency(Number(t.monthly_rent || 0))}</td><td>${t.move_in_date ? new Date(t.move_in_date).toLocaleDateString("de-DE") : "–"}</td><td>${t.unit_label || "–"}</td></tr>`).join("")}
</table>` : ""}
<p style="font-size:11px;color:#aaa;margin-top:40px;text-align:center">ImmoControl · Objektbericht · ${new Date().toLocaleDateString("de-DE")}</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [properties, loans, tenants, selectedProperty]);

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <div className="space-y-6 max-w-2xl mx-auto" role="main" aria-label="Berichte-Center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileBarChart className="h-6 w-6 text-primary" /> Berichte-Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Miet- und Objektberichte auf Knopfdruck erstellen</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="h-9 w-[120px] text-sm">
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger className="h-9 w-[200px] text-sm">
            <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Alle Objekte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Objekte</SelectItem>
            {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Report cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Mietbericht */}
        <div className="gradient-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Mietbericht</h3>
              <p className="text-[10px] text-muted-foreground">Übersicht aller Mietverhältnisse & Zahlungen</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {tenants.length} aktive Mieter · {payments.filter(p => p.status === "confirmed").length} bestätigte Zahlungen
          </div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={exportMietbericht}>
            <Download className="h-3.5 w-3.5" /> Mietbericht erstellen
          </Button>
        </div>

        {/* Objektbericht */}
        <div className="gradient-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Objektbericht</h3>
              <p className="text-[10px] text-muted-foreground">Detailbericht für ein einzelnes Objekt</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Finanzen, Darlehen, Mieter – alles auf einen Blick
          </div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={exportObjektbericht} disabled={!selectedProperty || selectedProperty === "all"}>
            <Download className="h-3.5 w-3.5" /> Objektbericht erstellen
          </Button>
        </div>

        {/* DATEV */}
        <div className="gradient-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">DATEV-Export</h3>
              <p className="text-[10px] text-muted-foreground">Buchhaltungsdaten für deinen Steuerberater</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Export im DATEV-kompatiblen CSV-Format für {year}
          </div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={exportDATEV}>
            <Download className="h-3.5 w-3.5" /> DATEV exportieren
          </Button>
        </div>

        {/* Portfolio-Bericht */}
        <div className="gradient-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileBarChart className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Portfoliobericht</h3>
              <p className="text-[10px] text-muted-foreground">Gesamtübersicht deines Portfolios als PDF</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {stats.propertyCount} Objekte · {formatCurrency(stats.totalValue)} Gesamtwert
          </div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => {
            // Reuse existing PDF export logic from dashboard
            toast.info("Nutze den PDF-Export im Dashboard für den Portfoliobericht.");
          }}>
            <Download className="h-3.5 w-3.5" /> Portfolio-PDF öffnen
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Berichte;
