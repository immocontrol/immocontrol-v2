import { useState, useMemo } from "react";
import { Scale, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";

const MIETSPIEGEL_RANGES: Record<string, { min: number; max: number }> = {
  "München": { min: 12.5, max: 19.5 },
  "Berlin": { min: 7.5, max: 13.0 },
  "Hamburg": { min: 9.0, max: 15.0 },
  "Frankfurt": { min: 10.0, max: 16.5 },
  "Köln": { min: 8.5, max: 14.0 },
  "Stuttgart": { min: 10.5, max: 16.0 },
  "Düsseldorf": { min: 9.0, max: 14.5 },
  "Leipzig": { min: 6.5, max: 10.0 },
  "Dresden": { min: 6.0, max: 9.5 },
  "Nürnberg": { min: 8.0, max: 12.5 },
};

const MietpreisbremseChecker = () => {
  const { properties } = useProperties();
  const [selectedId, setSelectedId] = useState(properties[0]?.id || "");

  const result = useMemo(() => {
    const prop = properties.find(p => p.id === selectedId);
    if (!prop || !prop.sqm || prop.sqm === 0) return null;
    const rentPerSqm = prop.monthlyRent / prop.sqm;
    const city = Object.keys(MIETSPIEGEL_RANGES).find(c => 
      prop.location?.includes(c) || prop.address?.includes(c)
    );
    const range = city ? MIETSPIEGEL_RANGES[city] : null;
    const maxAllowed = range ? range.max * 1.1 : null; // +10% Mietpreisbremse
    const isAbove = maxAllowed !== null && rentPerSqm > maxAllowed;
    return { prop, rentPerSqm, city, range, maxAllowed, isAbove };
  }, [selectedId, properties]);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Scale className="h-4 w-4 text-muted-foreground" /> Mietpreisbremse-Check
      </h3>
      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 mb-3"
      >
        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {result && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Aktuelle Miete/m²</span>
            <span className="font-semibold">{result.rentPerSqm.toFixed(2)} €/m²</span>
          </div>
          {result.city && result.range ? (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Mietspiegel {result.city}</span>
                <span>{result.range.min.toFixed(2)}–{result.range.max.toFixed(2)} €/m²</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Max. erlaubt (+10%)</span>
                <span className="font-semibold">{result.maxAllowed!.toFixed(2)} €/m²</span>
              </div>
              <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${result.isAbove ? "bg-loss/10 text-loss" : "bg-profit/10 text-profit"}`}>
                {result.isAbove ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                {result.isAbove
                  ? `Miete liegt ${(result.rentPerSqm - result.maxAllowed!).toFixed(2)} €/m² über dem Limit`
                  : "Miete liegt im erlaubten Bereich"}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" /> Kein Mietspiegel für diesen Standort hinterlegt
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MietpreisbremseChecker;