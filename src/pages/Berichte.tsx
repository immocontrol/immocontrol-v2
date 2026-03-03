import { useState, useEffect, useCallback, useMemo } from "react";
import { FileBarChart, Download, Building2, Users, Landmark, Calendar, Scale, Receipt, TrendingUp } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency, downloadBlob } from "@/lib/formatters";
import { TaxYearOverview } from "@/components/TaxYearOverview";

const Berichte = () => {
  const { properties, stats } = useProperties();
  const { user } = useAuth();
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

  const { data: insurances = [] } = useQuery({
    queryKey: ["berichte_insurances"],
    queryFn: async () => {
      const { data } = await supabase.from("property_insurances").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  /* FUNC-28: Report generation count tracker */
  const [reportCount, setReportCount] = useState(0);
  const trackReport = useCallback(() => setReportCount(c => c + 1), []);

  /* FUNC-29: Total portfolio metrics for reports */
  const reportMetrics = useMemo(() => ({
    totalRent: properties.reduce((s, p) => s + p.monthlyRent * 12, 0),
    totalExpenses: properties.reduce((s, p) => s + p.monthlyExpenses * 12, 0),
    totalCashflow: properties.reduce((s, p) => s + p.monthlyCashflow * 12, 0),
    avgRendite: properties.length > 0
      ? properties.reduce((s, p) => s + (p.purchasePrice > 0 ? (p.monthlyRent * 12 / p.purchasePrice * 100) : 0), 0) / properties.length
      : 0,
    totalDebt: loans.reduce((s, l) => s + Number(l.remaining_balance || 0), 0),
    totalInsurance: insurances.reduce((s, i) => s + Number(i.annual_premium || 0), 0),
  }), [properties, loans, insurances]);

  /* FUNC-30: Available report types for display */
  const reportTypes = useMemo(() => [
    { key: "portfolio", label: "Portfoliobericht", icon: "📊" },
    { key: "miet", label: "Mietbericht", icon: "🏠" },
    { key: "objekt", label: "Objektbericht", icon: "📋" },
    { key: "anlageV", label: "Anlage V", icon: "📄" },
    { key: "datev", label: "DATEV Export", icon: "💾" },
    { key: "eur", label: "EÜR", icon: "📊" },
    { key: "guv", label: "GuV", icon: "📈" },
  ], []);

  /* OPT-19: Memoized year list */
  /* IMP-34: Memoize year list to prevent recreation on every render */
  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()), []);

  /* IMP-35: Wrap openPrint in useCallback for stable reference */
  /* IMP-41-14: Track report generation timestamp for audit trail */
  const [lastReportGenerated, setLastReportGenerated] = useState<string | null>(null);
  const openPrint = useCallback((html: string) => {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    trackReport();
    setLastReportGenerated(new Date().toLocaleString("de-DE"));
  }, [trackReport]);

  const baseStyle = `body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto}
h1{font-size:22px;border-bottom:2px solid #2a9d6e;padding-bottom:8px}h2{font-size:16px;margin-top:24px;color:#555}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}th{background:#f5f5f5}
.positive{color:#2a9d6e}.negative{color:#d94040}
.summary{display:flex;gap:20px;margin:16px 0}.stat{background:#f9f9f9;padding:14px;border-radius:8px;flex:1}
.stat-label{font-size:11px;text-transform:uppercase;color:#888}.stat-value{font-size:20px;font-weight:700;margin-top:4px}
.footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center}`;

  // DATEV Export
  const exportDATEV = useCallback(() => {
    if (properties.length === 0) return;
    const headers = ["Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Buchungstext"];
    const rows: string[][] = [];
    properties.forEach(p => {
      for (let m = 1; m <= 12; m++) {
        rows.push([p.monthlyRent.toFixed(2).replace(".", ","), "H", "EUR", "8400", "1200", "", `${m.toString().padStart(2, "0")}01${year.slice(-2)}`, p.name, `Mieteinnahme ${p.name}`]);
      }
      if (p.monthlyExpenses > 0) {
        for (let m = 1; m <= 12; m++) {
          rows.push([p.monthlyExpenses.toFixed(2).replace(".", ","), "S", "EUR", "4200", "1200", "", `${m.toString().padStart(2, "0")}01${year.slice(-2)}`, p.name, `Bewirtschaftungskosten ${p.name}`]);
        }
      }
    });
    // NEW: Add loan interest entries
    loans.forEach(l => {
      const prop = properties.find(p => p.id === l.property_id);
      const monthlyInterest = Number(l.remaining_balance) * Number(l.interest_rate) / 100 / 12;
      for (let m = 1; m <= 12; m++) {
        rows.push([monthlyInterest.toFixed(2).replace(".", ","), "S", "EUR", "7300", "1200", "", `${m.toString().padStart(2, "0")}01${year.slice(-2)}`, prop?.name || l.bank_name, `Darlehenszinsen ${l.bank_name}`]);
      }
    });
    // NEW: Add insurance entries
    insurances.forEach(ins => {
      const prop = properties.find(p => p.id === ins.property_id);
      const monthly = Number(ins.annual_premium) / 12;
      for (let m = 1; m <= 12; m++) {
        rows.push([monthly.toFixed(2).replace(".", ","), "S", "EUR", "4360", "1200", "", `${m.toString().padStart(2, "0")}01${year.slice(-2)}`, prop?.name || "", `Versicherung ${ins.type}`]);
      }
    });
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    /* IMP-34-12: Use downloadBlob utility for consistent URL cleanup */
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `DATEV_Export_${year}.csv`);
    toast.success("DATEV-Export erstellt!");
  }, [properties, loans, insurances, year]);

  // Mietbericht
  const exportMietbericht = useCallback(() => {
    const prop = selectedProperty && selectedProperty !== "all" ? properties.find(p => p.id === selectedProperty) : null;
    const relevantTenants = selectedProperty && selectedProperty !== "all" ? tenants.filter(t => t.property_id === selectedProperty) : tenants;
    const relevantPayments = payments.filter(p => {
      const date = new Date(p.due_date);
      return date.getFullYear().toString() === year && (!selectedProperty || selectedProperty === "all" || p.property_id === selectedProperty);
    });
    const totalDue = relevantPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalPaid = relevantPayments.filter(p => p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0);

    openPrint(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Mietbericht ${year}</title>
<style>${baseStyle}</style></head><body>
<h1>📊 Mietbericht ${year}</h1>
${prop ? `<p><strong>Objekt:</strong> ${prop.name} · ${prop.address}</p>` : `<p><strong>Gesamtes Portfolio</strong> · ${properties.length} Objekte</p>`}
<div class="summary">
<div class="stat"><div class="stat-label">Soll-Miete</div><div class="stat-value">${formatCurrency(totalDue)}</div></div>
<div class="stat"><div class="stat-label">Ist-Miete</div><div class="stat-value positive">${formatCurrency(totalPaid)}</div></div>
<div class="stat"><div class="stat-label">Eingangsquote</div><div class="stat-value">${totalDue > 0 ? (totalPaid / totalDue * 100).toFixed(0) : 0}%</div></div>
<div class="stat"><div class="stat-label">Aktive Mieter</div><div class="stat-value">${relevantTenants.length}</div></div>
</div>
<table><tr><th>Mieter</th><th>Objekt</th><th>Miete/M</th><th>Einzug</th></tr>
${relevantTenants.map(t => {
  const p = properties.find(pr => pr.id === t.property_id);
  return `<tr><td>${t.first_name} ${t.last_name}</td><td>${p?.name || "–"}</td><td>${formatCurrency(Number(t.monthly_rent || 0))}</td><td>${t.move_in_date ? new Date(t.move_in_date).toLocaleDateString("de-DE") : "–"}</td></tr>`;
}).join("")}
</table>
<p class="footer">ImmoControl · Mietbericht · ${new Date().toLocaleDateString("de-DE")}</p>
</body></html>`);
    toast.success("Mietbericht erstellt");
  }, [properties, tenants, payments, selectedProperty, year]);

  // Objektbericht
  const exportObjektbericht = useCallback(() => {
    const prop = selectedProperty ? properties.find(p => p.id === selectedProperty) : null;
    if (!prop) { toast.error("Bitte Objekt wählen"); return; }
    const propLoans = loans.filter(l => l.property_id === prop.id);
    const propTenants = tenants.filter(t => t.property_id === prop.id);
    const bruttoRendite = prop.purchasePrice > 0 ? ((prop.monthlyRent * 12) / prop.purchasePrice * 100) : 0;

    openPrint(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Objektbericht – ${prop.name}</title>
<style>${baseStyle}</style></head><body>
<h1>🏠 Objektbericht – ${prop.name}</h1>
<p>${prop.address} · ${prop.type} · ${prop.units} Einheiten · ${prop.sqm} m² · Baujahr ${prop.yearBuilt}</p>
<h2>Finanzen</h2>
<table>
<tr><td>Kaufpreis</td><td>${formatCurrency(prop.purchasePrice)}</td></tr>
<tr><td>Aktueller Wert</td><td>${formatCurrency(prop.currentValue)}</td></tr>
<tr><td>Wertzuwachs</td><td class="${prop.currentValue >= prop.purchasePrice ? "positive" : "negative"}">${prop.purchasePrice > 0 ? ((prop.currentValue - prop.purchasePrice) / prop.purchasePrice * 100).toFixed(1) : "0.0"}%</td></tr>
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
<p class="footer">ImmoControl · Objektbericht · ${new Date().toLocaleDateString("de-DE")}</p>
</body></html>`);
  }, [properties, loans, tenants, selectedProperty]);

  // NEW: Anlage V Export
  const exportAnlageV = useCallback(() => {
    const yearInt = parseInt(year);
    const annualRent = properties.reduce((s, p) => s + p.monthlyRent * 12, 0);
    const annualExpenses = properties.reduce((s, p) => s + p.monthlyExpenses * 12, 0);
    const annualInterest = loans.reduce((s, l) => s + Number(l.remaining_balance) * Number(l.interest_rate) / 100, 0);
    const annualInsurance = insurances.reduce((s, i) => s + Number(i.annual_premium || 0), 0);
    const totalAfa = properties.reduce((s, p) => {
      const rate = (p.yearBuilt || 1970) >= 2023 ? 3 : 2;
      return s + (p.purchasePrice * 0.75 * rate / 100);
    }, 0);
    const werbungskosten = annualExpenses + annualInterest + annualInsurance + totalAfa;
    const einkuenfte = annualRent - werbungskosten;

    openPrint(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Anlage V ${year}</title>
<style>${baseStyle} .zeile{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px}
.zeile-label{color:#555}.zeile-value{font-weight:600}.section{margin-top:20px;padding:8px;background:#f5f5f5;font-weight:600;font-size:13px;border-radius:4px}</style></head><body>
<h1>📋 Anlage V – Einkünfte aus Vermietung & Verpachtung ${year}</h1>
<p>${properties.length} Objekte · Steuerjahr ${year}</p>

<div class="section">Zeile 9-20: Einnahmen</div>
${properties.map(p => `<div class="zeile"><span class="zeile-label">${p.name} – Mieteinnahmen</span><span class="zeile-value">${formatCurrency(p.monthlyRent * 12)}</span></div>`).join("")}
<div class="zeile" style="border-top:2px solid #222;font-weight:700"><span>Summe Einnahmen (Zeile 21)</span><span>${formatCurrency(annualRent)}</span></div>

<div class="section">Zeile 33-50: Werbungskosten</div>
<div class="zeile"><span class="zeile-label">Zeile 33: AfA (Absetzung für Abnutzung)</span><span class="zeile-value">${formatCurrency(totalAfa)}</span></div>
<div class="zeile"><span class="zeile-label">Zeile 37: Schuldzinsen</span><span class="zeile-value">${formatCurrency(annualInterest)}</span></div>
<div class="zeile"><span class="zeile-label">Zeile 46: Bewirtschaftungskosten</span><span class="zeile-value">${formatCurrency(annualExpenses)}</span></div>
<div class="zeile"><span class="zeile-label">Zeile 47: Versicherungsbeiträge</span><span class="zeile-value">${formatCurrency(annualInsurance)}</span></div>
<div class="zeile" style="border-top:2px solid #222;font-weight:700"><span>Summe Werbungskosten (Zeile 50)</span><span>${formatCurrency(werbungskosten)}</span></div>

<div class="section" style="background:${einkuenfte >= 0 ? "#e8f5e9" : "#fce4ec"}">Zeile 51: Einkünfte aus V+V</div>
<div class="zeile" style="font-size:16px;font-weight:700"><span>Einkünfte</span><span class="${einkuenfte >= 0 ? "negative" : "positive"}">${formatCurrency(einkuenfte)}</span></div>

<h2>Aufstellung je Objekt</h2>
<table><tr><th>Objekt</th><th>Miete/J</th><th>AfA/J</th><th>Zinsen/J</th><th>Kosten/J</th><th>Ergebnis</th></tr>
${properties.map(p => {
  const pLoans = loans.filter(l => l.property_id === p.id);
  const pInterest = pLoans.reduce((s, l) => s + Number(l.remaining_balance) * Number(l.interest_rate) / 100, 0);
  const pIns = insurances.filter(i => i.property_id === p.id).reduce((s, i) => s + Number(i.annual_premium || 0), 0);
  const afaRate = (p.yearBuilt || 1970) >= 2023 ? 3 : 2;
  const pAfa = p.purchasePrice * 0.75 * afaRate / 100;
  const pResult = p.monthlyRent * 12 - p.monthlyExpenses * 12 - pInterest - pIns - pAfa;
  return `<tr><td>${p.name}</td><td>${formatCurrency(p.monthlyRent * 12)}</td><td>${formatCurrency(pAfa)}</td><td>${formatCurrency(pInterest)}</td><td>${formatCurrency(p.monthlyExpenses * 12 + pIns)}</td><td class="${pResult >= 0 ? "negative" : "positive"}">${formatCurrency(pResult)}</td></tr>`;
}).join("")}
</table>
<p style="font-size:11px;color:#888;margin-top:12px">⚠ Diese Aufstellung dient als Hilfestellung und ersetzt keine steuerliche Beratung. Gebäudeanteil pauschal mit 75% angesetzt.</p>
<p class="footer">ImmoControl · Anlage V · ${new Date().toLocaleDateString("de-DE")}</p>
</body></html>`);
    toast.success("Anlage V erstellt!");
  }, [properties, loans, insurances, year]);

  // NEW: EÜR Export
  const exportEUR = useCallback(() => {
    const annualRent = properties.reduce((s, p) => s + p.monthlyRent * 12, 0);
    const annualExpenses = properties.reduce((s, p) => s + p.monthlyExpenses * 12, 0);
    const annualInterest = loans.reduce((s, l) => s + Number(l.remaining_balance) * Number(l.interest_rate) / 100, 0);
    const annualInsurance = insurances.reduce((s, i) => s + Number(i.annual_premium || 0), 0);
    const confirmedPayments = payments.filter(p => p.status === "confirmed" && new Date(p.due_date).getFullYear().toString() === year);
    const actualIncome = confirmedPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalExpenses = annualExpenses + annualInterest + annualInsurance;
    const profit = actualIncome - totalExpenses;

    openPrint(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>EÜR ${year}</title>
<style>${baseStyle}</style></head><body>
<h1>📊 Einnahmen-Überschuss-Rechnung ${year}</h1>
<h2>Betriebseinnahmen</h2>
<table>
<tr><td>Mieteinnahmen (Soll)</td><td>${formatCurrency(annualRent)}</td></tr>
<tr><td>Tatsächliche Einnahmen (Ist)</td><td class="positive">${formatCurrency(actualIncome)}</td></tr>
<tr style="font-weight:700;border-top:2px solid #222"><td>Summe Einnahmen</td><td>${formatCurrency(actualIncome)}</td></tr>
</table>
<h2>Betriebsausgaben</h2>
<table>
<tr><td>Bewirtschaftungskosten</td><td>${formatCurrency(annualExpenses)}</td></tr>
<tr><td>Schuldzinsen</td><td>${formatCurrency(annualInterest)}</td></tr>
<tr><td>Versicherungen</td><td>${formatCurrency(annualInsurance)}</td></tr>
<tr style="font-weight:700;border-top:2px solid #222"><td>Summe Ausgaben</td><td>${formatCurrency(totalExpenses)}</td></tr>
</table>
<h2>Ergebnis</h2>
<div class="summary"><div class="stat"><div class="stat-label">Überschuss / Verlust</div>
<div class="stat-value ${profit >= 0 ? "positive" : "negative"}">${formatCurrency(profit)}</div></div></div>
<p class="footer">ImmoControl · EÜR · ${new Date().toLocaleDateString("de-DE")}</p>
</body></html>`);
    toast.success("EÜR erstellt!");
  }, [properties, loans, insurances, payments, year]);

  // NEW: GuV per property
  const exportGuV = useCallback(() => {
    openPrint(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>GuV ${year}</title>
<style>${baseStyle}</style></head><body>
<h1>📈 Gewinn- und Verlustrechnung ${year}</h1>
${properties.map(p => {
  const pLoans = loans.filter(l => l.property_id === p.id);
  const pInterest = pLoans.reduce((s, l) => s + Number(l.remaining_balance) * Number(l.interest_rate) / 100, 0);
  const pIns = insurances.filter(i => i.property_id === p.id).reduce((s, i) => s + Number(i.annual_premium || 0), 0);
  const rent = p.monthlyRent * 12;
  const expenses = p.monthlyExpenses * 12;
  const profit = rent - expenses - pInterest - pIns;
  return `<h2>${p.name}</h2>
<table>
<tr><td>Mieteinnahmen</td><td class="positive">${formatCurrency(rent)}</td></tr>
<tr><td>Bewirtschaftung</td><td class="negative">-${formatCurrency(expenses)}</td></tr>
<tr><td>Zinsen</td><td class="negative">-${formatCurrency(pInterest)}</td></tr>
<tr><td>Versicherungen</td><td class="negative">-${formatCurrency(pIns)}</td></tr>
<tr style="font-weight:700;border-top:2px solid #222"><td>Ergebnis</td><td class="${profit >= 0 ? "positive" : "negative"}">${formatCurrency(profit)}</td></tr>
</table>`;
}).join("")}
<p class="footer">ImmoControl · GuV · ${new Date().toLocaleDateString("de-DE")}</p>
</body></html>`);
    toast.success("GuV erstellt!");
  }, [properties, loans, insurances, year]);

  /* Fix 15: Portfolio PDF export — generates actual PDF instead of showing toast */
  const exportPortfolio = useCallback(() => {
    if (properties.length === 0) { toast.error("Keine Objekte vorhanden"); return; }
    const rows = properties.map(p => {
      const rendite = p.purchasePrice > 0 ? (p.monthlyRent * 12 / p.purchasePrice * 100).toFixed(1) : "0.0";
      const cfClass = p.monthlyCashflow >= 0 ? "positive" : "negative";
      return `<tr><td>${p.name}</td><td>${p.address}</td><td>${formatCurrency(p.purchasePrice)}</td><td>${formatCurrency(p.currentValue)}</td><td>${formatCurrency(p.monthlyRent)}</td><td class="${cfClass}">${formatCurrency(p.monthlyCashflow)}</td><td>${rendite}%</td></tr>`;
    }).join("");
    const cfClass = reportMetrics.totalCashflow >= 0 ? "positive" : "negative";
    const ltv = stats.totalValue > 0 ? (reportMetrics.totalDebt / stats.totalValue * 100).toFixed(1) : "0.0";
    openPrint(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Portfoliobericht ${year}</title>
<style>${baseStyle}</style></head><body>
<h1>Portfolioübersicht ${year}</h1>
<p>${properties.length} Objekte · Gesamtwert: ${formatCurrency(stats.totalValue)} · EK: ${formatCurrency(stats.equity)}</p>
<div class="summary">
<div class="stat"><div class="stat-label">Jahresmiete</div><div class="stat-value positive">${formatCurrency(reportMetrics.totalRent)}</div></div>
<div class="stat"><div class="stat-label">Jahreskosten</div><div class="stat-value negative">${formatCurrency(reportMetrics.totalExpenses)}</div></div>
<div class="stat"><div class="stat-label">Cashflow/Jahr</div><div class="stat-value ${cfClass}">${formatCurrency(reportMetrics.totalCashflow)}</div></div>
<div class="stat"><div class="stat-label">Ø Rendite</div><div class="stat-value">${reportMetrics.avgRendite.toFixed(1)}%</div></div>
</div>
<h2>Objekte</h2>
<table><tr><th>Objekt</th><th>Adresse</th><th>Kaufpreis</th><th>Wert</th><th>Miete/M</th><th>Cashflow/M</th><th>Rendite</th></tr>
${rows}
</table>
<h2>Finanzierung</h2>
<table><tr><td>Gesamtschuld</td><td>${formatCurrency(reportMetrics.totalDebt)}</td></tr>
<tr><td>Versicherungen/Jahr</td><td>${formatCurrency(reportMetrics.totalInsurance)}</td></tr>
<tr><td>LTV</td><td>${ltv}%</td></tr>
</table>
<p class="footer">ImmoControl · Portfoliobericht · ${new Date().toLocaleDateString("de-DE")}</p>
</body></html>`);
    toast.success("Portfoliobericht erstellt!");
  }, [properties, stats, reportMetrics, year]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto" role="main" aria-label="Berichte-Center">
      {/* Improvement 10: Mobile responsive heading */}
      <div>
        {/* UPD-36: Smooth page header fade-in */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 page-header-enter">
          <FileBarChart className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Berichte-Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Miet-, Objekt- und Steuerberichte auf Knopfdruck
          {/* IMP-41-14: Show last report generation timestamp */}
          {lastReportGenerated && <span className="ml-2 text-[10px]">· Letzter Bericht: {lastReportGenerated}</span>}
          {reportCount > 0 && <span className="ml-1 text-[10px]">({reportCount} erstellt)</span>}
        </p>
      </div>

      {/* Quick Summary */}
      {/* IMP-38: Make KPI cards responsive on mobile */}
      {/* UPD-7: Add stagger animation to report summary cards */}
      {/* IMP-44-7: Use memoized reportMetrics instead of inline reduce() recalculations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0 card-stagger-enter">
        <div className="gradient-card rounded-xl border border-border p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Jahresmiete</p>
          <p className="text-lg font-bold text-profit">{formatCurrency(reportMetrics.totalRent)}</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Jahreskosten</p>
          <p className="text-lg font-bold text-loss">{formatCurrency(reportMetrics.totalExpenses)}</p>
        </div>
        <div className="gradient-card rounded-xl border border-border p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Netto-Cashflow</p>
          <p className={`text-lg font-bold ${reportMetrics.totalCashflow >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(reportMetrics.totalCashflow)}</p>
        </div>
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

      {/* Improvement 11: Report cards with stagger animation + hover glow */}
      {/* IMP-36: Ensure report cards grid never overflows */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 list-stagger min-w-0">
        {/* Mietbericht */}
        <div className="gradient-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Mietbericht</h3>
              <p className="text-[10px] text-muted-foreground">Mietverhältnisse & Zahlungen</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {tenants.length} Mieter · {payments.filter(p => p.status === "confirmed").length} bestätigt
          </div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={exportMietbericht}>
            <Download className="h-3.5 w-3.5" /> Erstellen
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
              <p className="text-[10px] text-muted-foreground">Detailbericht einzelnes Objekt</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Finanzen, Darlehen, Mieter</div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={exportObjektbericht} disabled={!selectedProperty || selectedProperty === "all"}>
            <Download className="h-3.5 w-3.5" /> Erstellen
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
              <p className="text-[10px] text-muted-foreground">Für den Steuerberater</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">CSV inkl. Zinsen & Versicherungen</div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={exportDATEV}>
            <Download className="h-3.5 w-3.5" /> CSV exportieren
          </Button>
        </div>

        {/* NEW: Anlage V */}
        <div className="gradient-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-profit/10 flex items-center justify-center">
              <Scale className="h-4 w-4 text-profit" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Anlage V</h3>
              <p className="text-[10px] text-muted-foreground">V+V Einkünfte für Finanzamt</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Zeilen 9-51 mit AfA & Werbungskosten</div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={exportAnlageV}>
            <Download className="h-3.5 w-3.5" /> Erstellen
          </Button>
        </div>

        {/* NEW: EÜR */}
        <div className="gradient-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-gold" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">EÜR</h3>
              <p className="text-[10px] text-muted-foreground">Einnahmen-Überschuss-Rechnung</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Ist-Einnahmen vs. Ausgaben</div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={exportEUR}>
            <Download className="h-3.5 w-3.5" /> Erstellen
          </Button>
        </div>

        {/* NEW: GuV */}
        <div className="gradient-card rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">GuV pro Objekt</h3>
              <p className="text-[10px] text-muted-foreground">Gewinn & Verlust je Immobilie</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{properties.length} Objekte einzeln ausgewertet</div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={exportGuV}>
            <Download className="h-3.5 w-3.5" /> Erstellen
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
              <p className="text-[10px] text-muted-foreground">Gesamtübersicht als PDF</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {stats.propertyCount} Objekte · {formatCurrency(stats.totalValue)}
          </div>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={exportPortfolio}>
            <Download className="h-3.5 w-3.5" /> Portfolio-PDF
          </Button>
        </div>
      </div>

      {/* Steuerliche Jahresübersicht — moved from Dashboard */}
      <TaxYearOverview />
    </div>
  );
};

export default Berichte;
