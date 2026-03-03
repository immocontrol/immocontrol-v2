/**
 * Dashboard export helpers — extracted from Dashboard.tsx for code splitting.
 * Handles CSV and PDF export of portfolio data.
 */
import { escapeHtml } from "@/lib/sanitize";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

interface ExportableProperty {
  name: string;
  address: string | null;
  type: string;
  units: number;
  purchasePrice: number;
  currentValue: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyCreditRate: number;
  monthlyCashflow: number;
  remainingDebt: number;
  interestRate: number;
  sqm: number;
  yearBuilt: number;
  ownership: string;
}

interface PortfolioStats {
  propertyCount: number;
  totalUnits: number;
  totalValue: number;
  equity: number;
  totalCashflow: number;
  avgRendite: number;
}

/** Export portfolio data as CSV with BOM for Excel compatibility */
export function exportPortfolioCSV(properties: ExportableProperty[]): void {
  if (properties.length === 0) return;
  const headers = [
    "Name", "Adresse", "Typ", "Einheiten", "Kaufpreis", "Aktueller Wert",
    "Miete/M", "Kosten/M", "Kreditrate/M", "Cashflow/M", "Cashflow/J",
    "Brutto-Rendite %", "Netto-Rendite %", "Restschuld", "Zinssatz",
    "m\u00b2", "Baujahr", "Besitz",
  ];
  const rows = properties.map((p) => {
    const bruttoRendite = p.purchasePrice > 0
      ? ((p.monthlyRent * 12) / p.purchasePrice * 100).toFixed(2)
      : "0";
    const nettoRendite = p.purchasePrice > 0
      ? (((p.monthlyRent - p.monthlyExpenses) * 12) / p.purchasePrice * 100).toFixed(2)
      : "0";
    return [
      escapeHtml(p.name), escapeHtml(p.address || ""), p.type, p.units,
      p.purchasePrice, p.currentValue, p.monthlyRent, p.monthlyExpenses,
      p.monthlyCreditRate, p.monthlyCashflow, p.monthlyCashflow * 12,
      bruttoRendite, nettoRendite, p.remainingDebt, p.interestRate,
      p.sqm, p.yearBuilt, escapeHtml(p.ownership),
    ];
  });
  const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `portfolio_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exportiert!");
}

/** Export portfolio as JSON file for backup/import */
export function exportPortfolioJSON(properties: ExportableProperty[], stats: PortfolioStats): void {
  if (properties.length === 0) return;
  const data = {
    meta: {
      exported: new Date().toISOString(),
      version: "1.0",
      propertyCount: stats.propertyCount,
      totalUnits: stats.totalUnits,
    },
    stats: {
      totalValue: stats.totalValue,
      equity: stats.equity,
      totalCashflow: stats.totalCashflow,
      avgRendite: stats.avgRendite,
    },
    properties: properties.map(p => ({
      name: p.name,
      address: p.address,
      type: p.type,
      units: p.units,
      purchasePrice: p.purchasePrice,
      currentValue: p.currentValue,
      monthlyRent: p.monthlyRent,
      monthlyExpenses: p.monthlyExpenses,
      monthlyCreditRate: p.monthlyCreditRate,
      monthlyCashflow: p.monthlyCashflow,
      remainingDebt: p.remainingDebt,
      interestRate: p.interestRate,
      sqm: p.sqm,
      yearBuilt: p.yearBuilt,
      ownership: p.ownership,
    })),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `portfolio_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("JSON exportiert!");
}

/** Export portfolio as printable PDF report */
export function exportPortfolioPDF(
  properties: ExportableProperty[],
  stats: PortfolioStats,
): void {
  if (properties.length === 0) return;
  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>ImmoControl Portfoliobericht</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto}
  h1{font-size:24px;border-bottom:2px solid #2a9d6e;padding-bottom:8px}
  h2{font-size:16px;margin-top:28px;color:#555}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
  th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #eee}
  th{background:#f5f5f5;font-weight:600}
  .positive{color:#2a9d6e} .negative{color:#d94040}
  .summary{display:flex;gap:20px;flex-wrap:wrap;margin-top:16px}
  .stat{background:#f9f9f9;padding:14px 18px;border-radius:8px;flex:1;min-width:150px}
  .stat-label{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.5px}
  .stat-value{font-size:20px;font-weight:700;margin-top:4px}
  .footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center}
</style></head><body>
<h1>\u{1f4ca} ImmoControl Portfoliobericht</h1>
<p style="color:#888;font-size:13px">Erstellt am ${new Date().toLocaleDateString("de-DE")} \u00b7 ${stats.propertyCount} Objekte \u00b7 ${stats.totalUnits} Einheiten</p>
<div class="summary">
  <div class="stat"><div class="stat-label">Gesamtwert</div><div class="stat-value">${formatCurrency(stats.totalValue)}</div></div>
  <div class="stat"><div class="stat-label">Eigenkapital</div><div class="stat-value">${formatCurrency(stats.equity)}</div></div>
  <div class="stat"><div class="stat-label">Cashflow / Monat</div><div class="stat-value ${stats.totalCashflow >= 0 ? "positive" : "negative"}">${formatCurrency(stats.totalCashflow)}</div></div>
  <div class="stat"><div class="stat-label">Brutto-Rendite</div><div class="stat-value">${stats.avgRendite.toFixed(1)}%</div></div>
</div>
<h2>Objekt\u00fcbersicht</h2>
<table>
<tr><th>Objekt</th><th>Adresse</th><th>Typ</th><th>Wert</th><th>Miete/M</th><th>Cashflow/M</th><th>Restschuld</th></tr>
${properties.map(p => `<tr>
  <td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.address || "")}</td><td>${escapeHtml(p.type)}</td>
  <td>${formatCurrency(p.currentValue)}</td><td>${formatCurrency(p.monthlyRent)}</td>
  <td class="${p.monthlyCashflow >= 0 ? "positive" : "negative"}">${formatCurrency(p.monthlyCashflow)}</td>
  <td>${formatCurrency(p.remainingDebt)}</td>
</tr>`).join("")}
</table>
<div class="footer">ImmoControl \u00b7 Portfoliobericht \u00b7 Vertraulich</div>
</body></html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
  toast.success("PDF-Bericht ge\u00f6ffnet");
}
