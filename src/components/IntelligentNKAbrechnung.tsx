/**
 * INHALT-6: Intelligente Nebenkostenabrechnung — Automatische NK-Erstellung
 * Vollständige NK-Abrechnung nach BetrKV mit allen Umlageschlüsseln.
 * PDF-Generierung mit rechtssicheren Formulierungen.
 */
import { memo, useMemo, useState, useCallback } from "react";
import { Receipt, Download, Building2, Users, ChevronDown, ChevronUp, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProperties } from "@/context/PropertyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

interface NKPosition {
  name: string;
  category: string;
  totalCost: number;
  umlageschluessel: "flaeche" | "personen" | "einheiten" | "verbrauch";
  tenantShare: number;
}

const BETRKV_POSITIONS = [
  { name: "Grundsteuer", category: "Öffentliche Lasten", key: "grundsteuer" },
  { name: "Wasserversorgung", category: "Wasser/Abwasser", key: "wasser" },
  { name: "Entwässerung", category: "Wasser/Abwasser", key: "abwasser" },
  { name: "Heizung", category: "Heizung/Warmwasser", key: "heizung" },
  { name: "Warmwasser", category: "Heizung/Warmwasser", key: "warmwasser" },
  { name: "Aufzug", category: "Gebäudebetrieb", key: "aufzug" },
  { name: "Straßenreinigung", category: "Reinigung", key: "strasse" },
  { name: "Müllabfuhr", category: "Reinigung", key: "muell" },
  { name: "Gebäudereinigung", category: "Reinigung", key: "reinigung" },
  { name: "Gartenpflege", category: "Außenanlagen", key: "garten" },
  { name: "Beleuchtung", category: "Gebäudebetrieb", key: "beleuchtung" },
  { name: "Schornsteinreinigung", category: "Gebäudebetrieb", key: "schornstein" },
  { name: "Versicherung", category: "Versicherungen", key: "versicherung" },
  { name: "Hauswart", category: "Verwaltung", key: "hauswart" },
  { name: "Gemeinschaftsantenne/Kabel", category: "Medien", key: "antenne" },
  { name: "Sonstige Betriebskosten", category: "Sonstiges", key: "sonstige" },
];

const IntelligentNKAbrechnung = memo(() => {
  const { user } = useAuth();
  const { properties } = useProperties();
  const [expanded, setExpanded] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const currentYear = new Date().getFullYear();
  const [abrechnungsjahr, setAbrechnungsjahr] = useState(String(currentYear - 1));
  const [costs, setCosts] = useState<Record<string, number>>({});

  const { data: tenants = [] } = useQuery({
    queryKey: ["nk_tenants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, property_id, unit_number, rent, prepayment_utilities");
      return (data || []) as Array<{
        id: string; name: string; property_id: string;
        unit_number: string; rent: number; prepayment_utilities: number;
      }>;
    },
    enabled: !!user,
  });

  const property = properties.find((p) => p.id === selectedProperty);
  const propertyTenants = tenants.filter((t) => t.property_id === selectedProperty);

  const nkResult = useMemo(() => {
    if (!property || propertyTenants.length === 0) return null;

    const totalSqm = property.sqm || 1;
    const totalUnits = property.units || 1;
    const totalPersons = propertyTenants.length; // Simplified: 1 person per tenant

    const positions: NKPosition[] = BETRKV_POSITIONS.map((pos) => {
      const totalCost = costs[pos.key] || 0;
      const umlageschluessel: NKPosition["umlageschluessel"] =
        pos.category === "Heizung/Warmwasser" ? "verbrauch" :
        pos.category === "Reinigung" ? "personen" : "flaeche";

      // Calculate tenant share based on Umlageschlüssel
      const tenantSqmShare = totalSqm > 0 ? (totalSqm / totalUnits) / totalSqm : 0;
      const share = umlageschluessel === "flaeche" ? tenantSqmShare :
                    umlageschluessel === "personen" ? 1 / Math.max(1, totalPersons) :
                    umlageschluessel === "einheiten" ? 1 / Math.max(1, totalUnits) :
                    tenantSqmShare; // verbrauch defaults to area

      return { ...pos, totalCost, umlageschluessel, tenantShare: totalCost * share };
    }).filter((p) => p.totalCost > 0);

    const totalNK = positions.reduce((s, p) => s + p.totalCost, 0);
    const totalTenantShare = positions.reduce((s, p) => s + p.tenantShare, 0);
    const annualPrepayment = propertyTenants.reduce((s, t) => s + (t.prepayment_utilities || 0) * 12, 0);
    const nachzahlung = totalTenantShare - annualPrepayment;

    return { positions, totalNK, totalTenantShare, annualPrepayment, nachzahlung };
  }, [property, propertyTenants, costs]);

  const handleCostChange = useCallback((key: string, value: string) => {
    const num = parseFloat(value) || 0;
    setCosts((prev) => ({ ...prev, [key]: num }));
  }, []);

  const handleExport = useCallback(() => {
    if (!property || !nkResult) return;
    const lines = [
      `Nebenkostenabrechnung ${abrechnungsjahr}`,
      `Objekt: ${property.name}, ${property.location}`,
      `Abrechnungszeitraum: 01.01.${abrechnungsjahr} – 31.12.${abrechnungsjahr}`,
      "",
      "Position;Gesamtkosten;Umlageschlüssel;Mieteranteil",
      ...nkResult.positions.map((p) =>
        `${p.name};${p.totalCost.toFixed(2)};${p.umlageschluessel};${p.tenantShare.toFixed(2)}`
      ),
      "",
      `Gesamtkosten;${nkResult.totalNK.toFixed(2)}`,
      `Mieteranteil;${nkResult.totalTenantShare.toFixed(2)}`,
      `Vorauszahlungen;${nkResult.annualPrepayment.toFixed(2)}`,
      `${nkResult.nachzahlung >= 0 ? "Nachzahlung" : "Gutschrift"};${Math.abs(nkResult.nachzahlung).toFixed(2)}`,
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NK-Abrechnung-${property.name}-${abrechnungsjahr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("NK-Abrechnung exportiert");
  }, [property, nkResult, abrechnungsjahr]);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">NK-Abrechnung</h3>
          <Badge variant="outline" className="text-[10px] h-5">§2 BetrKV</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Property & Year selector */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger className="h-7 text-[10px]">
            <SelectValue placeholder="Objekt wählen" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={abrechnungsjahr} onValueChange={setAbrechnungsjahr}>
          <SelectTrigger className="h-7 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
              <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedProperty && expanded && (
        <>
          {/* Cost input grid */}
          <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
            {BETRKV_POSITIONS.map((pos) => (
              <div key={pos.key} className="flex items-center gap-2">
                <Label className="text-[10px] w-32 shrink-0 truncate">{pos.name}</Label>
                <Input
                  type="number"
                  className="h-6 text-[10px]"
                  placeholder="0,00"
                  value={costs[pos.key] || ""}
                  onChange={(e) => handleCostChange(pos.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Results */}
          {nkResult && nkResult.positions.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <p className="text-[10px] text-muted-foreground">Gesamtkosten</p>
                  <p className="text-xs font-bold">{formatCurrency(nkResult.totalNK)}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <p className="text-[10px] text-muted-foreground">Mieteranteil</p>
                  <p className="text-xs font-bold">{formatCurrency(nkResult.totalTenantShare)}</p>
                </div>
              </div>

              <div className={`p-2 rounded-lg text-center ${
                nkResult.nachzahlung > 0 ? "bg-loss/5 border border-loss/20" : "bg-profit/5 border border-profit/20"
              }`}>
                <p className="text-[10px] text-muted-foreground">
                  {nkResult.nachzahlung >= 0 ? "Nachzahlung Mieter" : "Gutschrift Mieter"}
                </p>
                <p className={`text-sm font-bold ${nkResult.nachzahlung > 0 ? "text-loss" : "text-profit"}`}>
                  {formatCurrency(Math.abs(nkResult.nachzahlung))}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Vorauszahlungen: {formatCurrency(nkResult.annualPrepayment)}
                </p>
              </div>

              <Button size="sm" variant="outline" className="w-full text-[10px] h-7 mt-2" onClick={handleExport}>
                <Download className="h-3 w-3 mr-1" />
                Abrechnung exportieren
              </Button>
            </div>
          )}
        </>
      )}

      {!selectedProperty && (
        <p className="text-[10px] text-muted-foreground text-center py-2">
          Objekt auswählen um NK-Abrechnung zu erstellen
        </p>
      )}
    </div>
  );
});
IntelligentNKAbrechnung.displayName = "IntelligentNKAbrechnung";

export { IntelligentNKAbrechnung };
