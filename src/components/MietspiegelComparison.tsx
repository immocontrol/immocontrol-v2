/**
 * #20: Mietspiegel-Integration — Automatic rent comparison with local market rates.
 * Compares current rents with average market rates based on city/zip code.
 * Uses a built-in reference table for major German cities.
 */
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, MapPin } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Property {
  id: string;
  name: string;
  address: string;
  city?: string;
  zipCode?: string;
  monthlyRent: number;
  sqm: number;
  units: number;
}

interface MietspiegelData {
  city: string;
  avgPerSqm: number;
  minPerSqm: number;
  maxPerSqm: number;
}

/** Reference rent data for major German cities (avg EUR/sqm cold rent, 2024/2025) */
const MIETSPIEGEL_DB: Record<string, MietspiegelData> = {
  berlin: { city: "Berlin", avgPerSqm: 11.5, minPerSqm: 7.0, maxPerSqm: 18.0 },
  hamburg: { city: "Hamburg", avgPerSqm: 12.8, minPerSqm: 8.0, maxPerSqm: 19.0 },
  münchen: { city: "München", avgPerSqm: 19.5, minPerSqm: 12.0, maxPerSqm: 28.0 },
  muenchen: { city: "München", avgPerSqm: 19.5, minPerSqm: 12.0, maxPerSqm: 28.0 },
  köln: { city: "Köln", avgPerSqm: 12.2, minPerSqm: 7.5, maxPerSqm: 17.0 },
  koeln: { city: "Köln", avgPerSqm: 12.2, minPerSqm: 7.5, maxPerSqm: 17.0 },
  frankfurt: { city: "Frankfurt", avgPerSqm: 14.8, minPerSqm: 9.0, maxPerSqm: 22.0 },
  düsseldorf: { city: "Düsseldorf", avgPerSqm: 12.5, minPerSqm: 8.0, maxPerSqm: 18.0 },
  duesseldorf: { city: "Düsseldorf", avgPerSqm: 12.5, minPerSqm: 8.0, maxPerSqm: 18.0 },
  stuttgart: { city: "Stuttgart", avgPerSqm: 14.2, minPerSqm: 9.0, maxPerSqm: 20.0 },
  dortmund: { city: "Dortmund", avgPerSqm: 8.5, minPerSqm: 5.5, maxPerSqm: 12.0 },
  essen: { city: "Essen", avgPerSqm: 8.2, minPerSqm: 5.0, maxPerSqm: 12.0 },
  leipzig: { city: "Leipzig", avgPerSqm: 8.8, minPerSqm: 5.5, maxPerSqm: 13.0 },
  bremen: { city: "Bremen", avgPerSqm: 9.5, minPerSqm: 6.0, maxPerSqm: 14.0 },
  dresden: { city: "Dresden", avgPerSqm: 8.5, minPerSqm: 5.5, maxPerSqm: 12.5 },
  hannover: { city: "Hannover", avgPerSqm: 10.2, minPerSqm: 6.5, maxPerSqm: 15.0 },
  nürnberg: { city: "Nürnberg", avgPerSqm: 11.0, minPerSqm: 7.0, maxPerSqm: 16.0 },
  nuernberg: { city: "Nürnberg", avgPerSqm: 11.0, minPerSqm: 7.0, maxPerSqm: 16.0 },
  duisburg: { city: "Duisburg", avgPerSqm: 7.5, minPerSqm: 4.5, maxPerSqm: 11.0 },
  bochum: { city: "Bochum", avgPerSqm: 7.8, minPerSqm: 5.0, maxPerSqm: 11.5 },
  wuppertal: { city: "Wuppertal", avgPerSqm: 7.2, minPerSqm: 4.5, maxPerSqm: 10.5 },
  bielefeld: { city: "Bielefeld", avgPerSqm: 8.5, minPerSqm: 5.5, maxPerSqm: 12.0 },
  bonn: { city: "Bonn", avgPerSqm: 11.8, minPerSqm: 7.5, maxPerSqm: 17.0 },
  münster: { city: "Münster", avgPerSqm: 12.0, minPerSqm: 7.5, maxPerSqm: 17.5 },
  muenster: { city: "Münster", avgPerSqm: 12.0, minPerSqm: 7.5, maxPerSqm: 17.5 },
  karlsruhe: { city: "Karlsruhe", avgPerSqm: 11.5, minPerSqm: 7.0, maxPerSqm: 16.0 },
  mannheim: { city: "Mannheim", avgPerSqm: 11.0, minPerSqm: 7.0, maxPerSqm: 15.5 },
  augsburg: { city: "Augsburg", avgPerSqm: 11.2, minPerSqm: 7.0, maxPerSqm: 16.0 },
  wiesbaden: { city: "Wiesbaden", avgPerSqm: 13.0, minPerSqm: 8.0, maxPerSqm: 18.5 },
  aachen: { city: "Aachen", avgPerSqm: 10.5, minPerSqm: 6.5, maxPerSqm: 15.0 },
  freiburg: { city: "Freiburg", avgPerSqm: 14.0, minPerSqm: 9.0, maxPerSqm: 20.0 },
  mainz: { city: "Mainz", avgPerSqm: 12.5, minPerSqm: 8.0, maxPerSqm: 18.0 },
  potsdam: { city: "Potsdam", avgPerSqm: 12.0, minPerSqm: 7.5, maxPerSqm: 17.0 },
  rostock: { city: "Rostock", avgPerSqm: 8.5, minPerSqm: 5.5, maxPerSqm: 12.5 },
  kiel: { city: "Kiel", avgPerSqm: 9.5, minPerSqm: 6.0, maxPerSqm: 14.0 },
  lübeck: { city: "Lübeck", avgPerSqm: 9.8, minPerSqm: 6.0, maxPerSqm: 14.5 },
  luebeck: { city: "Lübeck", avgPerSqm: 9.8, minPerSqm: 6.0, maxPerSqm: 14.5 },
};

function findMietspiegel(city?: string): MietspiegelData | null {
  if (!city) return null;
  const normalized = city.toLowerCase().trim().replace(/\s+/g, "");
  return MIETSPIEGEL_DB[normalized] || null;
}

interface ComparisonResult {
  property: Property;
  mietspiegel: MietspiegelData | null;
  currentPerSqm: number;
  diffPercent: number;
  diffAbsolute: number;
  potentialMonthly: number;
  status: "above" | "below" | "average" | "unknown";
}

interface MietspiegelComparisonProps {
  properties: Property[];
}

export function MietspiegelComparison({ properties }: MietspiegelComparisonProps) {
  const comparisons = useMemo((): ComparisonResult[] => {
    return properties.map((p) => {
      const mietspiegel = findMietspiegel(p.city);
      const currentPerSqm = p.sqm > 0 ? p.monthlyRent / p.sqm : 0;

      if (!mietspiegel || p.sqm <= 0) {
        return {
          property: p,
          mietspiegel,
          currentPerSqm,
          diffPercent: 0,
          diffAbsolute: 0,
          potentialMonthly: 0,
          status: "unknown" as const,
        };
      }

      const diffAbsolute = currentPerSqm - mietspiegel.avgPerSqm;
      const diffPercent = mietspiegel.avgPerSqm > 0 ? (diffAbsolute / mietspiegel.avgPerSqm) * 100 : 0;
      const potentialMonthly = (mietspiegel.avgPerSqm - currentPerSqm) * p.sqm;

      let status: "above" | "below" | "average" = "average";
      if (diffPercent > 5) status = "above";
      else if (diffPercent < -5) status = "below";

      return { property: p, mietspiegel, currentPerSqm, diffPercent, diffAbsolute, potentialMonthly, status };
    });
  }, [properties]);

  const avgStats = useMemo(() => {
    const withData = comparisons.filter((c) => c.status !== "unknown");
    if (withData.length === 0) return null;
    const totalPotential = withData.reduce((s, c) => s + c.potentialMonthly, 0);
    const belowCount = withData.filter((c) => c.status === "below").length;
    const aboveCount = withData.filter((c) => c.status === "above").length;
    return { totalPotential, belowCount, aboveCount, totalWithData: withData.length };
  }, [comparisons]);

  if (properties.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Mietspiegel-Vergleich</h3>
      </div>

      {avgStats && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
            <div className="text-muted-foreground">Unter Markt</div>
            <div className="text-lg font-bold text-gold">{avgStats.belowCount}</div>
          </div>
          <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
            <div className="text-muted-foreground">Über Markt</div>
            <div className="text-lg font-bold text-profit">{avgStats.aboveCount}</div>
          </div>
          <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
            <div className="text-muted-foreground">Mietpotenzial/M</div>
            <div className={`text-lg font-bold ${avgStats.totalPotential > 0 ? "text-profit" : "text-muted-foreground"}`}>
              {avgStats.totalPotential > 0 ? `+${formatCurrency(avgStats.totalPotential)}` : "–"}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {comparisons.map((c) => (
          <div key={c.property.id} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-secondary/20 transition-colors">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-medium truncate">{c.property.name}</span>
              {c.property.city && (
                <span className="text-muted-foreground text-[10px] shrink-0">({c.property.city})</span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-muted-foreground">
                {c.currentPerSqm > 0 ? `${c.currentPerSqm.toFixed(2)} EUR/m²` : "–"}
              </span>
              {c.status === "unknown" ? (
                <span className="text-muted-foreground text-[10px]">Keine Daten</span>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`flex items-center gap-0.5 font-medium ${
                      c.status === "above" ? "text-profit" : c.status === "below" ? "text-gold" : "text-muted-foreground"
                    }`}>
                      {c.status === "above" ? <TrendingUp className="h-3 w-3" /> :
                       c.status === "below" ? <TrendingDown className="h-3 w-3" /> :
                       <Minus className="h-3 w-3" />}
                      {c.diffPercent > 0 ? "+" : ""}{c.diffPercent.toFixed(0)}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Markt-Durchschnitt: {c.mietspiegel?.avgPerSqm.toFixed(2)} EUR/m²<br />
                      Spanne: {c.mietspiegel?.minPerSqm.toFixed(2)}–{c.mietspiegel?.maxPerSqm.toFixed(2)} EUR/m²
                      {c.potentialMonthly > 0 && <><br />Potenzial: +{formatCurrency(c.potentialMonthly)}/M</>}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
