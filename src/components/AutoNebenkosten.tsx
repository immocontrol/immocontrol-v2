/**
 * #14: Automatische Nebenkostenabrechnung — Aus erfassten Kosten automatisch Abrechnung generieren
 */
import { useState, useMemo, useCallback } from "react";
import { Calculator, Download, FileText, Building2 } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, downloadBlob } from "@/lib/formatters";
import { Button } from "@/components/ui/button";

interface BillingItem {
  id: string;
  billing_id: string;
  cost_type: string;
  total_amount: number;
  distribution_key: string;
}

interface Billing {
  id: string;
  property_id: string;
  billing_year: number;
  total_amount: number;
  status: string;
}

export function AutoNebenkosten() {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 1);

  const { data: billings = [] } = useQuery<Billing[]>({
    queryKey: ["nebenkosten_billings", selectedProperty, selectedYear],
    queryFn: async () => {
      if (!selectedProperty) return [];
      const { data } = await supabase
        .from("utility_billings")
        .select("*")
        .eq("property_id", selectedProperty)
        .eq("billing_year", selectedYear);
      return (data || []) as Billing[];
    },
    enabled: !!user && !!selectedProperty,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["nebenkosten_tenants", selectedProperty],
    queryFn: async () => {
      if (!selectedProperty) return [];
      const { data } = await supabase
        .from("tenants")
        .select("id, name, monthly_rent, is_active, sqm")
        .eq("property_id", selectedProperty);
      return (data || []) as { id: string; name: string; monthly_rent: number; is_active: boolean; sqm: number }[];
    },
    enabled: !!user && !!selectedProperty,
  });

  const property = useMemo(
    () => properties.find(p => p.id === selectedProperty),
    [properties, selectedProperty]
  );

  const totalNebenkosten = billings.reduce((s, b) => s + Number(b.total_amount || 0), 0);

  const tenantShares = useMemo(() => {
    if (!property || tenants.length === 0) return [];
    const totalSqm = tenants.reduce((s, t) => s + (t.sqm || property.sqm / property.units), 0);
    return tenants.map(t => {
      const sqm = t.sqm || property.sqm / property.units;
      const share = totalSqm > 0 ? sqm / totalSqm : 1 / tenants.length;
      const amount = totalNebenkosten * share;
      const prepaid = t.monthly_rent * 0.2 * 12; // Assume 20% of rent is Nebenkosten-Vorauszahlung
      const diff = prepaid - amount;
      return {
        id: t.id,
        name: t.name,
        sqm,
        share: share * 100,
        amount,
        prepaid,
        diff,
        isCredit: diff >= 0,
      };
    });
  }, [property, tenants, totalNebenkosten]);

  const generatePDF = useCallback(() => {
    if (!property || tenantShares.length === 0) return;
    const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>Nebenkostenabrechnung ${selectedYear}</title>
<style>
body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto}
h1{font-size:20px;border-bottom:2px solid #2a9d6e;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #eee}
th{background:#f5f5f5;font-weight:600}
.positive{color:#2a9d6e}.negative{color:#d94040}
.footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center}
</style></head><body>
<h1>Nebenkostenabrechnung ${selectedYear}</h1>
<p><strong>Objekt:</strong> ${property.name}<br/>
<strong>Adresse:</strong> ${property.address || "–"}<br/>
<strong>Abrechnungszeitraum:</strong> 01.01.${selectedYear} – 31.12.${selectedYear}</p>
<p><strong>Gesamtkosten:</strong> ${formatCurrency(totalNebenkosten)}</p>
<table>
<tr><th>Mieter</th><th>m²</th><th>Anteil</th><th>Kosten</th><th>Vorauszahlung</th><th>Differenz</th></tr>
${tenantShares.map(t => `<tr>
<td>${t.name}</td><td>${t.sqm.toFixed(0)}</td><td>${t.share.toFixed(1)}%</td>
<td>${formatCurrency(t.amount)}</td><td>${formatCurrency(t.prepaid)}</td>
<td class="${t.isCredit ? 'positive' : 'negative'}">${t.isCredit ? "Guthaben" : "Nachzahlung"}: ${formatCurrency(Math.abs(t.diff))}</td>
</tr>`).join("")}
</table>
<div class="footer">Erstellt am ${new Date().toLocaleDateString("de-DE")} mit ImmoControl</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    downloadBlob(blob, `Nebenkostenabrechnung_${selectedYear}_${property.name}.html`);
  }, [property, tenantShares, selectedYear, totalNebenkosten]);

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Nebenkostenabrechnung
        </h3>
      </div>

      <div className="flex gap-2 mb-3">
        <select
          value={selectedProperty}
          onChange={e => setSelectedProperty(e.target.value)}
          className="text-xs bg-secondary border border-border rounded px-2 py-1.5 flex-1"
        >
          <option value="">Objekt wählen...</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="text-xs bg-secondary border border-border rounded px-2 py-1.5 w-20"
        >
          {[0, 1, 2, 3].map(i => {
            const y = new Date().getFullYear() - i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>

      {selectedProperty && property && (
        <>
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Gesamtkosten {selectedYear}</span>
              <span className="text-sm font-bold">{formatCurrency(totalNebenkosten)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {billings.length} Abrechnungsposition{billings.length !== 1 ? "en" : ""} · {tenants.length} Mieter
            </p>
          </div>

          {tenantShares.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {tenantShares.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.sqm.toFixed(0)} m² · {t.share.toFixed(1)}%</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">{formatCurrency(t.amount)}</p>
                    <p className={`text-[10px] font-bold ${t.isCredit ? "text-profit" : "text-loss"}`}>
                      {t.isCredit ? "Guthaben" : "Nachzahlung"}: {formatCurrency(Math.abs(t.diff))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button size="sm" variant="outline" className="w-full text-xs" onClick={generatePDF}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Abrechnung als HTML exportieren
          </Button>
        </>
      )}

      {!selectedProperty && (
        <div className="text-center py-4 text-xs text-muted-foreground">
          <Building2 className="h-6 w-6 mx-auto mb-1 opacity-30" />
          Objekt auswählen um Abrechnung zu generieren
        </div>
      )}
    </div>
  );
}

export default AutoNebenkosten;
