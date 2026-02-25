import { useState } from "react";
import { Calculator } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";

const HEBESATZ_MAP: Record<string, number> = {
  "Berlin": 810, "München": 535, "Hamburg": 540, "Frankfurt": 500,
  "Köln": 515, "Stuttgart": 520, "Düsseldorf": 440, "Leipzig": 650,
  "Dresden": 635, "Nürnberg": 535,
};

const GrundsteuerCalculator = () => {
  const { properties } = useProperties();
  const [selectedId, setSelectedId] = useState(properties[0]?.id || "");
  const [bodenrichtwert, setBodenrichtwert] = useState(200);
  const [grundstueckFlaeche, setGrundstueckFlaeche] = useState(500);

  const prop = properties.find(p => p.id === selectedId);
  if (!prop || properties.length === 0) return null;

  const city = Object.keys(HEBESATZ_MAP).find(c => prop.location?.includes(c) || prop.address?.includes(c));
  const hebesatz = city ? HEBESATZ_MAP[city] : 500;

  // Simplified Bundesmodell calculation
  const grundsteuerwert = bodenrichtwert * grundstueckFlaeche * 0.0004;
  const steuermessbetrag = grundsteuerwert * 0.00031;
  const grundsteuer = steuermessbetrag * hebesatz / 100;
  const monatlich = grundsteuer / 12;

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-muted-foreground" /> Grundsteuer-Rechner (ab 2025)
      </h3>
      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 mb-3"
      >
        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] text-muted-foreground">Bodenrichtwert (€/m²)</label>
          <input type="number" value={bodenrichtwert} onChange={e => setBodenrichtwert(+e.target.value)}
            className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Grundstücksfläche (m²)</label>
          <input type="number" value={grundstueckFlaeche} onChange={e => setGrundstueckFlaeche(+e.target.value)}
            className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2" />
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">Hebesatz {city || "Standard"}</span><span>{hebesatz}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Grundsteuerwert</span><span>{formatCurrency(grundsteuerwert)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Steuermessbetrag</span><span>{formatCurrency(steuermessbetrag)}</span></div>
        <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
          <span>Grundsteuer/Jahr</span><span className="text-loss">{formatCurrency(grundsteuer)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Pro Monat</span><span>{formatCurrency(monatlich)}</span>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground mt-2">⚠ Vereinfachte Berechnung nach Bundesmodell. Tatsächliche Werte können abweichen.</p>
    </div>
  );
};

export default GrundsteuerCalculator;