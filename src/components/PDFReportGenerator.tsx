/**
 * #14: PDF Report Generator — Monthly portfolio report with branding.
 * Generates a comprehensive HTML report and opens it in a new window for printing/saving as PDF.
 */
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { escapeHtml } from "@/lib/sanitize";

interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  units: number;
  purchasePrice: number;
  currentValue: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyCashflow: number;
  remainingDebt: number;
  interestRate: number;
  sqm: number;
}

interface PortfolioStats {
  propertyCount: number;
  totalUnits: number;
  totalValue: number;
  totalDebt: number;
  equity: number;
  totalRent: number;
  totalCashflow: number;
  avgRendite: number;
}

interface PDFReportGeneratorProps {
  properties: Property[];
  stats: PortfolioStats;
}

export function PDFReportGenerator({ properties, stats }: PDFReportGeneratorProps) {
  const generateReport = useCallback(() => {
    if (properties.length === 0) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
    const monthYear = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const ltv = stats.totalValue > 0 ? ((stats.totalDebt / stats.totalValue) * 100).toFixed(1) : "0";

    const propertyRows = properties
      .map((p) => {
        const yieldPct = p.purchasePrice > 0 ? ((p.monthlyRent * 12) / p.purchasePrice * 100).toFixed(2) : "0";
        return `<tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.address || "–")}</td>
          <td>${p.type}</td>
          <td class="right">${p.units}</td>
          <td class="right">${formatCurrency(p.currentValue)}</td>
          <td class="right">${formatCurrency(p.monthlyRent)}</td>
          <td class="right ${p.monthlyCashflow >= 0 ? "positive" : "negative"}">${formatCurrency(p.monthlyCashflow)}</td>
          <td class="right">${yieldPct}%</td>
          <td class="right">${formatCurrency(p.remainingDebt)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>ImmoControl Portfoliobericht — ${monthYear}</title>
  <style>
    @page { margin: 20mm; size: A4 landscape; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; padding: 32px; background: #fff; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2a9d6e; padding-bottom: 16px; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 800; color: #2a9d6e; letter-spacing: -0.5px; }
    .logo span { color: #1a1a2e; }
    .date { font-size: 12px; color: #666; text-align: right; }
    .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    h2 { font-size: 15px; color: #333; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 14px; }
    .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600; }
    .kpi-value { font-size: 20px; font-weight: 700; margin-top: 4px; }
    .kpi-sub { font-size: 10px; color: #888; margin-top: 2px; }
    .positive { color: #2a9d6e; }
    .negative { color: #d94040; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    .right { text-align: right; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #eee; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Immo<span>Control</span></div>
      <div class="subtitle">Monatlicher Portfoliobericht — ${monthYear}</div>
    </div>
    <div class="date">Erstellt am ${dateStr}<br/>Vertraulich</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Gesamtwert</div>
      <div class="kpi-value">${formatCurrency(stats.totalValue)}</div>
      <div class="kpi-sub">${stats.propertyCount} Objekte · ${stats.totalUnits} Einheiten</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Eigenkapital</div>
      <div class="kpi-value positive">${formatCurrency(stats.equity)}</div>
      <div class="kpi-sub">LTV: ${ltv}%</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Mieteinnahmen / Monat</div>
      <div class="kpi-value">${formatCurrency(stats.totalRent)}</div>
      <div class="kpi-sub">${formatCurrency(stats.totalRent * 12)} / Jahr</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Cashflow / Monat</div>
      <div class="kpi-value ${stats.totalCashflow >= 0 ? "positive" : "negative"}">${formatCurrency(stats.totalCashflow)}</div>
      <div class="kpi-sub">Ø Rendite: ${stats.avgRendite.toFixed(1)}%</div>
    </div>
  </div>

  <h2>Objektübersicht</h2>
  <table>
    <thead>
      <tr>
        <th>Objekt</th><th>Adresse</th><th>Typ</th><th class="right">WE</th>
        <th class="right">Wert</th><th class="right">Miete/M</th><th class="right">Cashflow/M</th>
        <th class="right">Rendite</th><th class="right">Restschuld</th>
      </tr>
    </thead>
    <tbody>${propertyRows}</tbody>
    <tfoot>
      <tr style="font-weight:700;border-top:2px solid #333">
        <td colspan="3">Gesamt</td>
        <td class="right">${stats.totalUnits}</td>
        <td class="right">${formatCurrency(stats.totalValue)}</td>
        <td class="right">${formatCurrency(stats.totalRent)}</td>
        <td class="right ${stats.totalCashflow >= 0 ? "positive" : "negative"}">${formatCurrency(stats.totalCashflow)}</td>
        <td class="right">${stats.avgRendite.toFixed(1)}%</td>
        <td class="right">${formatCurrency(stats.totalDebt)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>ImmoControl Portfoliobericht — Automatisch generiert</span>
    <span>${dateStr}</span>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, [properties, stats]);

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={generateReport} disabled={properties.length === 0}>
      <FileText className="h-3.5 w-3.5" />
      PDF-Bericht
    </Button>
  );
}
