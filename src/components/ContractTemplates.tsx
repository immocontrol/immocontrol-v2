/**
 * #15: Vertragsvorlagen mit Auto-Fill — Mietvertrag-Template das automatisch Objekt+Mieter-Daten einfügt
 */
import { useState, useMemo, useCallback } from "react";
import { FileText, Download, Building2, Users } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, downloadBlob } from "@/lib/formatters";
import { Button } from "@/components/ui/button";

interface Tenant {
  id: string;
  name: string;
  property_id: string;
  monthly_rent: number;
  email: string | null;
}

type TemplateType = "mietvertrag" | "kuendigung" | "mietbescheinigung" | "uebergabeprotokoll";

const TEMPLATES: Record<TemplateType, { label: string; icon: string }> = {
  mietvertrag: { label: "Mietvertrag", icon: "📋" },
  kuendigung: { label: "Kündigung", icon: "📮" },
  mietbescheinigung: { label: "Mietbescheinigung", icon: "📄" },
  uebergabeprotokoll: { label: "Übergabeprotokoll", icon: "🔑" },
};

function generateTemplate(
  type: TemplateType,
  property: { name: string; address: string },
  tenant: { name: string; monthly_rent: number; email: string | null },
): string {
  const today = new Date().toLocaleDateString("de-DE");

  switch (type) {
    case "mietvertrag":
      return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Mietvertrag</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto;line-height:1.6}
h1{font-size:22px;text-align:center;margin-bottom:30px}h2{font-size:16px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}
.field{background:#f5f5f5;padding:2px 8px;border-radius:4px;font-weight:600}
.signature{margin-top:60px;display:flex;justify-content:space-between}
.sig-line{border-top:1px solid #333;width:200px;text-align:center;padding-top:4px;font-size:12px}</style></head><body>
<h1>Mietvertrag</h1>
<p>Zwischen <span class="field">Vermieter: [Name eintragen]</span> (nachfolgend „Vermieter")<br/>
und <span class="field">${tenant.name}</span> (nachfolgend „Mieter")</p>
<h2>§ 1 Mietobjekt</h2>
<p>Vermietet wird die Wohnung/das Objekt:<br/>
<strong>${property.name}</strong><br/>${property.address || "[Adresse eintragen]"}</p>
<h2>§ 2 Mietdauer</h2>
<p>Das Mietverhältnis beginnt am <span class="field">[Datum eintragen]</span> und wird auf unbestimmte Zeit geschlossen.</p>
<h2>§ 3 Miete</h2>
<p>Die monatliche Kaltmiete beträgt <strong>${formatCurrency(tenant.monthly_rent)}</strong>.<br/>
Die Nebenkosten-Vorauszahlung beträgt <span class="field">[Betrag eintragen]</span> EUR/Monat.</p>
<h2>§ 4 Kaution</h2>
<p>Der Mieter zahlt eine Kaution in Höhe von <span class="field">${formatCurrency(tenant.monthly_rent * 3)}</span> (3 Monatsmieten).</p>
<h2>§ 5 Kündigung</h2>
<p>Die Kündigungsfrist beträgt 3 Monate zum Monatsende gemäß § 573c BGB.</p>
<div class="signature">
<div><div class="sig-line">Vermieter, ${today}</div></div>
<div><div class="sig-line">Mieter, ${today}</div></div>
</div></body></html>`;

    case "kuendigung":
      return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Kündigung Mietvertrag</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto;line-height:1.6}
h1{font-size:20px}
.field{background:#f5f5f5;padding:2px 8px;border-radius:4px;font-weight:600}</style></head><body>
<p>${today}</p>
<h1>Kündigung des Mietverhältnisses</h1>
<p>Sehr geehrte/r ${tenant.name},</p>
<p>hiermit kündige ich das Mietverhältnis über die Wohnung<br/>
<strong>${property.name}</strong>, ${property.address || "[Adresse]"}<br/>
ordentlich mit einer Frist von 3 Monaten zum <span class="field">[Datum eintragen]</span>.</p>
<p>Bitte vereinbaren Sie einen Termin zur Wohnungsübergabe.</p>
<p>Mit freundlichen Grüßen<br/><br/><br/>_______________________<br/>Vermieter</p>
</body></html>`;

    case "mietbescheinigung":
      return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Mietbescheinigung</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto;line-height:1.6}
h1{font-size:20px;text-align:center}</style></head><body>
<h1>Mietbescheinigung</h1>
<p>Hiermit bestätige ich, dass <strong>${tenant.name}</strong> seit <span style="background:#f5f5f5;padding:2px 8px;border-radius:4px">[Datum]</span>
die Wohnung <strong>${property.name}</strong>, ${property.address || "[Adresse]"} bewohnt.</p>
<p>Die monatliche Kaltmiete beträgt <strong>${formatCurrency(tenant.monthly_rent)}</strong>.</p>
<p>Die Miete wird regelmäßig und pünktlich gezahlt.</p>
<p>${today}<br/><br/><br/>_______________________<br/>Vermieter</p>
</body></html>`;

    case "uebergabeprotokoll":
      return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Übergabeprotokoll</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto;line-height:1.6}
h1{font-size:20px;text-align:center}h2{font-size:16px;margin-top:20px}
table{width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border:1px solid #ddd}th{background:#f5f5f5}</style></head><body>
<h1>Wohnungsübergabeprotokoll</h1>
<p><strong>Objekt:</strong> ${property.name}, ${property.address || "[Adresse]"}<br/>
<strong>Mieter:</strong> ${tenant.name}<br/>
<strong>Datum:</strong> ${today}</p>
<h2>Zählerstände</h2>
<table><tr><th>Zähler</th><th>Nr.</th><th>Stand</th></tr>
<tr><td>Strom</td><td></td><td></td></tr>
<tr><td>Gas</td><td></td><td></td></tr>
<tr><td>Wasser</td><td></td><td></td></tr>
<tr><td>Heizung</td><td></td><td></td></tr></table>
<h2>Raumzustand</h2>
<table><tr><th>Raum</th><th>Zustand</th><th>Mängel</th></tr>
<tr><td>Küche</td><td></td><td></td></tr>
<tr><td>Bad</td><td></td><td></td></tr>
<tr><td>Wohnzimmer</td><td></td><td></td></tr>
<tr><td>Schlafzimmer</td><td></td><td></td></tr>
<tr><td>Flur</td><td></td><td></td></tr></table>
<h2>Schlüssel</h2>
<p>Übergeben: _____ Stück Hausschlüssel, _____ Stück Wohnungsschlüssel, _____ Briefkastenschlüssel</p>
<div style="display:flex;justify-content:space-between;margin-top:50px">
<div style="border-top:1px solid #333;width:200px;text-align:center;padding-top:4px;font-size:12px">Vermieter</div>
<div style="border-top:1px solid #333;width:200px;text-align:center;padding-top:4px;font-size:12px">Mieter</div>
</div></body></html>`;
  }
}

export function ContractTemplates() {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("mietvertrag");

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["contract_tenants", selectedProperty],
    queryFn: async () => {
      if (!selectedProperty) return [];
      const { data } = await supabase
        .from("tenants")
        .select("id, name, property_id, monthly_rent, email")
        .eq("property_id", selectedProperty);
      return (data || []) as Tenant[];
    },
    enabled: !!user && !!selectedProperty,
  });

  const property = properties.find(p => p.id === selectedProperty);
  const tenant = tenants.find(t => t.id === selectedTenant);

  const handleGenerate = useCallback(() => {
    if (!property || !tenant) return;
    const html = generateTemplate(
      selectedTemplate,
      { name: property.name, address: property.address || "" },
      { name: tenant.name, monthly_rent: tenant.monthly_rent, email: tenant.email },
    );
    const blob = new Blob([html], { type: "text/html" });
    downloadBlob(blob, `${TEMPLATES[selectedTemplate].label}_${property.name}_${tenant.name}.html`);
  }, [property, tenant, selectedTemplate]);

  return (
    <div className="gradient-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Vertragsvorlagen
        </h3>
      </div>

      <div className="space-y-2 mb-3">
        <select
          value={selectedProperty}
          onChange={e => { setSelectedProperty(e.target.value); setSelectedTenant(""); }}
          className="w-full text-xs bg-secondary border border-border rounded px-2 py-1.5"
        >
          <option value="">Objekt wählen...</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {selectedProperty && (
          <select
            value={selectedTenant}
            onChange={e => setSelectedTenant(e.target.value)}
            className="w-full text-xs bg-secondary border border-border rounded px-2 py-1.5"
          >
            <option value="">Mieter wählen...</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({formatCurrency(t.monthly_rent)}/M)</option>
            ))}
          </select>
        )}
      </div>

      {/* Template selection */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {(Object.entries(TEMPLATES) as [TemplateType, { label: string; icon: string }][]).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setSelectedTemplate(key)}
            className={`flex items-center gap-1.5 text-xs p-2 rounded-lg border transition-colors ${
              selectedTemplate === key
                ? "bg-primary/10 border-primary/30 text-primary font-medium"
                : "border-border hover:bg-secondary"
            }`}
          >
            <span>{val.icon}</span>
            {val.label}
          </button>
        ))}
      </div>

      <Button
        size="sm"
        className="w-full text-xs"
        disabled={!property || !tenant}
        onClick={handleGenerate}
      >
        <Download className="h-3.5 w-3.5 mr-1.5" />
        {TEMPLATES[selectedTemplate].label} generieren
      </Button>

      {!selectedProperty && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Wähle Objekt + Mieter, dann wird die Vorlage automatisch befüllt.
        </p>
      )}
    </div>
  );
}

export default ContractTemplates;
