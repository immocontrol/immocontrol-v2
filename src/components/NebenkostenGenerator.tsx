/**
 * #18: Automatische Nebenkostenabrechnung — Auto-generate utility cost invoices.
 * Calculates tenant shares based on living area (sqm) and generates
 * settlement documents for each tenant.
 */
import { useMemo, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Download, Calculator, FileText, FileSpreadsheet } from "lucide-react";
import { formatCurrency, downloadBlob } from "@/lib/formatters";
import { escapeHtml } from "@/lib/sanitize";
import { toast } from "sonner";

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  unit_number?: string;
  monthly_rent: number;
  is_active: boolean;
}

interface NebenkostenCosts {
  heating: number;
  water: number;
  trash: number;
  insurance: number;
  propertyTax: number;
  maintenance: number;
  management: number;
  other: number;
}

interface NebenkostenGeneratorProps {
  propertyName: string;
  propertyAddress: string;
  tenants: Tenant[];
  totalSqm: number;
  year?: number;
}

const DEFAULT_COSTS: NebenkostenCosts = {
  heating: 0,
  water: 0,
  trash: 0,
  insurance: 0,
  propertyTax: 0,
  maintenance: 0,
  management: 0,
  other: 0,
};

export function NebenkostenGenerator({
  propertyName,
  propertyAddress,
  tenants,
  totalSqm,
  year = new Date().getFullYear() - 1,
}: NebenkostenGeneratorProps) {
  const [costs, setCosts] = useState<NebenkostenCosts>({ ...DEFAULT_COSTS });
  const [tenantSqm, setTenantSqm] = useState<Record<string, number>>({});
  const [monthlyAdvances, setMonthlyAdvances] = useState<Record<string, number>>({});

  const activeTenants = useMemo(() => tenants.filter((t) => t.is_active), [tenants]);

  const totalCosts = useMemo(() => {
    return Object.values(costs).reduce((s, v) => s + (Number(v) || 0), 0);
  }, [costs]);

  const tenantShares = useMemo(() => {
    if (totalSqm <= 0 || totalCosts <= 0) return [];
    return activeTenants.map((t) => {
      const sqm = tenantSqm[t.id] || 0;
      const share = totalSqm > 0 ? sqm / totalSqm : 0;
      const amount = totalCosts * share;
      const advance = (monthlyAdvances[t.id] || 0) * 12;
      const balance = advance - amount;
      return {
        tenant: t,
        sqm,
        share,
        amount,
        advance,
        balance,
        isRefund: balance >= 0,
      };
    });
  }, [activeTenants, totalSqm, totalCosts, tenantSqm, monthlyAdvances]);

  /* Fix 14: Export as PDF (print), Word (HTML-based .doc), or CSV — no HTML download */
  const [exportFormat, setExportFormat] = useState<"pdf" | "word" | "csv">("pdf");

  const costItemsData = useMemo(() => [
    { label: "Heizkosten", value: costs.heating },
    { label: "Wasser/Abwasser", value: costs.water },
    { label: "Müllabfuhr", value: costs.trash },
    { label: "Versicherungen", value: costs.insurance },
    { label: "Grundsteuer", value: costs.propertyTax },
    { label: "Instandhaltung", value: costs.maintenance },
    { label: "Hausverwaltung", value: costs.management },
    { label: "Sonstiges", value: costs.other },
  ].filter((c) => c.value > 0), [costs]);

  const generateSettlement = useCallback(() => {
    if (tenantShares.length === 0) {
      toast.error("Keine Mieterdaten vorhanden");
      return;
    }

    if (exportFormat === "csv") {
      /* CSV/Excel export */
      const headers = ["Mieter", "Einheit", "Fläche (m²)", "Anteil (%)", "Kosten (€)", "Vorauszahlung (€)", "Ergebnis (€)", "Status"];
      const rows = tenantShares.map(ts => [
        `${ts.tenant.first_name} ${ts.tenant.last_name}`,
        ts.tenant.unit_number || "–",
        ts.sqm.toFixed(1),
        (ts.share * 100).toFixed(1),
        ts.amount.toFixed(2),
        ts.advance.toFixed(2),
        Math.abs(ts.balance).toFixed(2),
        ts.isRefund ? "Guthaben" : "Nachzahlung",
      ]);
      /* Add cost breakdown section */
      const costSection = [[""], ["Kostenaufstellung"], ["Position", "Betrag (€)"],
        ...costItemsData.map(c => [c.label, c.value.toFixed(2)]),
        ["Gesamtkosten", totalCosts.toFixed(2)],
      ];
      const allRows = [headers, ...rows, ...costSection];
      const csv = allRows.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `Nebenkostenabrechnung_${year}_${propertyName.replace(/\s+/g, "_")}.csv`);
      toast.success("CSV-Export erstellt");
      return;
    }

    /* Build HTML for both PDF (print) and Word (.doc) export */
    const tenantRows = tenantShares
      .map(
        (ts) => `<tr>
        <td>${escapeHtml(ts.tenant.first_name)} ${escapeHtml(ts.tenant.last_name)}</td>
        <td>${ts.tenant.unit_number || "–"}</td>
        <td class="right">${ts.sqm.toFixed(1)} m²</td>
        <td class="right">${(ts.share * 100).toFixed(1)}%</td>
        <td class="right">${formatCurrency(ts.amount)}</td>
        <td class="right">${formatCurrency(ts.advance)}</td>
        <td class="right ${ts.isRefund ? "positive" : "negative"}">${formatCurrency(Math.abs(ts.balance))} ${ts.isRefund ? "(Guthaben)" : "(Nachzahlung)"}</td>
      </tr>`
      )
      .join("");

    const costItemsHtml = costItemsData
      .map((c) => `<tr><td>${c.label}</td><td class="right">${formatCurrency(c.value)}</td></tr>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Nebenkostenabrechnung ${year} — ${escapeHtml(propertyName)}</title>
  <style>
    @page { margin: 20mm; }
    body { font-family: system-ui, sans-serif; color: #333; padding: 32px; line-height: 1.6; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #666; margin-bottom: 24px; }
    h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: 600; }
    .right { text-align: right; }
    .positive { color: #2a9d6e; }
    .negative { color: #d94040; }
    .total { font-weight: 700; border-top: 2px solid #333; }
    .footer { margin-top: 32px; font-size: 10px; color: #aaa; }
  </style>
</head>
<body>
  <h1>Nebenkostenabrechnung ${year}</h1>
  <div class="subtitle">${escapeHtml(propertyName)} · ${escapeHtml(propertyAddress)}</div>

  <h2>Kostenaufstellung</h2>
  <table>
    <thead><tr><th>Position</th><th class="right">Betrag</th></tr></thead>
    <tbody>${costItemsHtml}</tbody>
    <tfoot><tr class="total"><td>Gesamtkosten</td><td class="right">${formatCurrency(totalCosts)}</td></tr></tfoot>
  </table>

  <h2>Mieteraufteilung nach Wohnfläche</h2>
  <table>
    <thead>
      <tr><th>Mieter</th><th>Einheit</th><th class="right">Fläche</th><th class="right">Anteil</th><th class="right">Kosten</th><th class="right">Vorauszahlung</th><th class="right">Ergebnis</th></tr>
    </thead>
    <tbody>${tenantRows}</tbody>
  </table>

  <div class="footer">
    <p>Erstellt am ${new Date().toLocaleDateString("de-DE")} · ImmoControl Nebenkostenabrechnung</p>
  </div>
  ${exportFormat === "pdf" ? '<script>window.onload = () => window.print();</script>' : ''}
</body>
</html>`;

    if (exportFormat === "word") {
      /* Word (.doc) export — browsers open HTML-based .doc files natively */
      const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
      downloadBlob(blob, `Nebenkostenabrechnung_${year}_${propertyName.replace(/\s+/g, "_")}.doc`);
      toast.success("Word-Export erstellt");
    } else {
      /* PDF export via browser print dialog */
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
      toast.success("PDF-Druckvorschau geöffnet");
    }
  }, [tenantShares, costs, costItemsData, totalCosts, year, propertyName, propertyAddress, exportFormat]);

  const updateCost = (key: keyof NebenkostenCosts, value: string) => {
    /* FIX-1: Use global /,/g to replace ALL commas */
    setCosts((prev) => ({ ...prev, [key]: parseFloat(value.replace(/,/g, ".")) || 0 }));
  };

  const costFields: Array<{ key: keyof NebenkostenCosts; label: string }> = [
    { key: "heating", label: "Heizkosten" },
    { key: "water", label: "Wasser/Abwasser" },
    { key: "trash", label: "Müllabfuhr" },
    { key: "insurance", label: "Versicherungen" },
    { key: "propertyTax", label: "Grundsteuer" },
    { key: "maintenance", label: "Instandhaltung" },
    { key: "management", label: "Hausverwaltung" },
    { key: "other", label: "Sonstiges" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Receipt className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Nebenkostenabrechnung {year}</h3>
      </div>

      {/* Cost inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {costFields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
            <Input
              type="number"
              step="0.01"
              className="h-8 text-xs"
              value={costs[field.key] || ""}
              onChange={(e) => updateCost(field.key, e.target.value)}
              placeholder="0,00"
            />
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between text-sm bg-secondary/30 rounded-lg p-3">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5" /> Gesamtkosten
        </span>
        <span className="font-semibold">{formatCurrency(totalCosts)}</span>
      </div>

      {/* Tenant sqm and advance inputs */}
      {activeTenants.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Mieterdaten</Label>
          {activeTenants.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <span className="w-32 truncate">{t.first_name} {t.last_name}</span>
              <Input
                type="number"
                step="0.1"
                className="h-7 text-xs w-20"
                placeholder="m²"
                value={tenantSqm[t.id] || ""}
                onChange={(e) => setTenantSqm((prev) => ({ ...prev, [t.id]: parseFloat(e.target.value) || 0 }))}
              />
              <span className="text-muted-foreground">m²</span>
              <Input
                type="number"
                step="0.01"
                className="h-7 text-xs w-24"
                placeholder="Vorauszahlung/M"
                value={monthlyAdvances[t.id] || ""}
                onChange={(e) => setMonthlyAdvances((prev) => ({ ...prev, [t.id]: parseFloat(e.target.value) || 0 }))}
              />
              <span className="text-muted-foreground">/M</span>
            </div>
          ))}
        </div>
      )}

      {/* Export format selector + Generate button */}
      <div className="flex items-center gap-2">
        <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "pdf" | "word" | "csv")}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf"><span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> PDF</span></SelectItem>
            <SelectItem value="word"><span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> Word</span></SelectItem>
            <SelectItem value="csv"><span className="flex items-center gap-1.5"><FileSpreadsheet className="h-3 w-3" /> CSV/Excel</span></SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5" onClick={generateSettlement} disabled={totalCosts <= 0}>
          <Download className="h-3.5 w-3.5" />
          Abrechnung erstellen
        </Button>
      </div>
    </div>
  );
}
