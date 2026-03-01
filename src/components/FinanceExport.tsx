import { useState, useCallback } from "react";
import { Download, FileText, FileSpreadsheet, Calendar } from "lucide-react";
import { escapeHtml } from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useProperties } from "@/context/PropertyContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

export const FinanceExportDialog = () => {
  const { properties, stats } = useProperties();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);

  const exportSteuerCSV = useCallback(async () => {
    if (!user || properties.length === 0) return;
    setLoading(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const { data: payments } = await supabase
        .from("rent_payments")
        .select("*, tenants(first_name, last_name, unit_label)")
        .eq("landlord_id", user.id)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date", { ascending: true });

      const headers = [
        "Objekt", "Mieter", "Einheit", "Fällig am", "Bezahlt am",
        "Betrag", "Status", "Notiz"
      ];

      // Build property lookup
      const propMap = new Map(properties.map(p => [p.id, p.name]));

      const rows = (payments || []).map((p: any) => [
        propMap.get(p.property_id) || p.property_id,
        p.tenants ? `${p.tenants.first_name} ${p.tenants.last_name}` : "",
        p.tenants?.unit_label || "",
        p.due_date,
        p.paid_date || "",
        Number(p.amount).toFixed(2).replace(".", ","),
        p.status === "confirmed" ? "Bestätigt" : p.status === "overdue" ? "Überfällig" : p.status === "cancelled" ? "Storniert" : "Ausstehend",
        p.note || "",
      ]);

      // Summary rows
      const confirmed = (payments || []).filter((p: any) => p.status === "confirmed");
      const totalConfirmed = confirmed.reduce((s: number, p: any) => s + Number(p.amount), 0);
      const totalAll = (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);

      rows.push([]);
      rows.push(["ZUSAMMENFASSUNG"]);
      rows.push(["Gesamteinnahmen (bestätigt)", "", "", "", "", totalConfirmed.toFixed(2).replace(".", ",")]);
      rows.push(["Gesamtbetrag (alle)", "", "", "", "", totalAll.toFixed(2).replace(".", ",")]);
      rows.push(["Anzahl Zahlungen", "", "", "", "", String((payments || []).length)]);

      // Add property summary
      rows.push([]);
      rows.push(["OBJEKTÜBERSICHT"]);
      rows.push(["Objekt", "Miete/M", "Kosten/M", "Kreditrate/M", "Cashflow/M", "Jahres-Cashflow"]);
      for (const prop of properties) {
        rows.push([
          prop.name,
          prop.monthlyRent.toFixed(2).replace(".", ","),
          prop.monthlyExpenses.toFixed(2).replace(".", ","),
          prop.monthlyCreditRate.toFixed(2).replace(".", ","),
          prop.monthlyCashflow.toFixed(2).replace(".", ","),
          (prop.monthlyCashflow * 12).toFixed(2).replace(".", ","),
        ]);
      }

      const csv = [headers.join(";"), ...rows.map(r => (r as string[]).join(";"))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `steuer_export_${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Steuer-Export ${year} heruntergeladen`);
    } catch (e: unknown) {
      toast.error("Fehler beim Export");
    } finally {
      setLoading(false);
    }
  }, [user, properties, year]);

  const exportJahresbericht = useCallback(async () => {
    if (!user || properties.length === 0) return;
    setLoading(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const { data: payments } = await supabase
        .from("rent_payments")
        .select("*, tenants(first_name, last_name, unit_label)")
        .eq("landlord_id", user.id)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .eq("status", "confirmed")
        .order("due_date", { ascending: true });

      const propMap = new Map(properties.map(p => [p.id, p]));
      const totalConfirmed = (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);

      // Group payments by property
      const byProperty = new Map<string, any[]>();
      for (const p of payments || []) {
        const arr = byProperty.get(p.property_id) || [];
        arr.push(p);
        byProperty.set(p.property_id, arr);
      }

      // Group payments by month
      const byMonth = new Map<string, number>();
      for (const p of payments || []) {
        const m = p.due_date.slice(0, 7);
        byMonth.set(m, (byMonth.get(m) || 0) + Number(p.amount));
      }

      const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

      const html = `
<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>Jahresbericht ${year}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:900px;margin:0 auto}
  h1{font-size:24px;border-bottom:2px solid #2a9d6e;padding-bottom:8px}
  h2{font-size:16px;margin-top:32px;color:#555}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
  th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #eee}
  th{background:#f5f5f5;font-weight:600}
  .positive{color:#2a9d6e} .negative{color:#d94040}
  .summary{display:flex;gap:20px;flex-wrap:wrap;margin-top:16px}
  .stat{background:#f9f9f9;padding:14px 18px;border-radius:8px;flex:1;min-width:150px}
  .stat-label{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:0.5px}
  .stat-value{font-size:20px;font-weight:700;margin-top:4px}
  .footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center}
  .month-chart{display:flex;align-items:end;gap:4px;height:120px;margin-top:16px}
  .month-bar{flex:1;background:#2a9d6e;border-radius:4px 4px 0 0;min-width:20px;position:relative}
  .month-label{font-size:9px;text-align:center;color:#888;margin-top:4px}
  @media print{body{padding:20px}}
</style></head><body>
<h1>📊 Jahresbericht ${year}</h1>
<p style="color:#888;font-size:13px">Erstellt am ${new Date().toLocaleDateString("de-DE")} · ${properties.length} Objekte</p>

<div class="summary">
  <div class="stat"><div class="stat-label">Gesamteinnahmen</div><div class="stat-value positive">${formatCurrency(totalConfirmed)}</div></div>
  <div class="stat"><div class="stat-label">Portfoliowert</div><div class="stat-value">${formatCurrency(stats.totalValue)}</div></div>
  <div class="stat"><div class="stat-label">Eigenkapital</div><div class="stat-value">${formatCurrency(stats.equity)}</div></div>
  <div class="stat"><div class="stat-label">Cashflow/Monat</div><div class="stat-value ${stats.totalCashflow >= 0 ? "positive" : "negative"}">${formatCurrency(stats.totalCashflow)}</div></div>
</div>

<h2>Monatliche Einnahmen</h2>
<table>
<tr><th>Monat</th><th>Einnahmen</th></tr>
${months.map((m, i) => {
  const key = `${year}-${String(i + 1).padStart(2, "0")}`;
  const val = byMonth.get(key) || 0;
  return `<tr><td>${m}</td><td class="positive">${formatCurrency(val)}</td></tr>`;
}).join("")}
<tr style="font-weight:bold;border-top:2px solid #ccc"><td>Gesamt</td><td class="positive">${formatCurrency(totalConfirmed)}</td></tr>
</table>

<h2>Einnahmen pro Objekt</h2>
<table>
<tr><th>Objekt</th><th>Adresse</th><th>Einnahmen ${year}</th><th>Miete/M</th><th>Cashflow/M</th><th>Cashflow/Jahr</th></tr>
${properties.map(prop => {
  const propPayments = byProperty.get(prop.id) || [];
  const propTotal = propPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  return `<tr>
    <td><strong>${escapeHtml(prop.name)}</strong></td>
    <td>${escapeHtml(prop.address || "")}</td>
    <td class="positive">${formatCurrency(propTotal)}</td>
    <td>${formatCurrency(prop.monthlyRent)}</td>
    <td class="${prop.monthlyCashflow >= 0 ? "positive" : "negative"}">${formatCurrency(prop.monthlyCashflow)}</td>
    <td class="${prop.monthlyCashflow >= 0 ? "positive" : "negative"}">${formatCurrency(prop.monthlyCashflow * 12)}</td>
  </tr>`;
}).join("")}
</table>

<h2>Alle bestätigten Zahlungen</h2>
<table>
<tr><th>Datum</th><th>Objekt</th><th>Mieter</th><th>Betrag</th></tr>
${(payments || []).map((p: any) => {
  const prop = propMap.get(p.property_id);
  return `<tr>
    <td>${new Date(p.due_date).toLocaleDateString("de-DE")}</td>
    <td>${escapeHtml(prop?.name || "")}</td>
    <td>${p.tenants ? `${escapeHtml(p.tenants.first_name)} ${escapeHtml(p.tenants.last_name)}` : ""}</td>
    <td class="positive">${formatCurrency(Number(p.amount))}</td>
  </tr>`;
}).join("")}
</table>

<div class="footer">ImmoControl · Jahresbericht ${year} · Vertraulich</div>
</body></html>`;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      }
      toast.success(`Jahresbericht ${year} geöffnet`);
    } catch (e: unknown) {
      toast.error("Fehler beim Erstellen des Berichts");
    } finally {
      setLoading(false);
    }
  }, [user, properties, stats, year]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex">
          <FileText className="h-3.5 w-3.5" />
          Berichte
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finanz-Berichte & Export</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Jahr</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min="2020"
              max="2030"
              className="h-9 text-sm w-32"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={exportSteuerCSV}
              disabled={loading || properties.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4 text-profit shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">Steuer-Export (CSV)</div>
                <div className="text-[10px] text-muted-foreground">
                  Alle Zahlungen + Objektübersicht für den Steuerberater
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={exportJahresbericht}
              disabled={loading || properties.length === 0}
            >
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="text-left">
                <div className="text-sm font-medium">Jahresbericht (PDF)</div>
                <div className="text-[10px] text-muted-foreground">
                  Monatliche Einnahmen, Objektübersicht, Zahlungshistorie
                </div>
              </div>
            </Button>
          </div>

          {properties.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Keine Objekte vorhanden – füge zuerst Objekte hinzu.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* FUNC-44: Export format options */
const EXPORT_FORMATS = [
  { key: "csv", label: "CSV", ext: ".csv", mime: "text/csv" },
  { key: "json", label: "JSON", ext: ".json", mime: "application/json" },
] as const;

/* OPT-32: File download helper */
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
