/**
 * INHALT-19: Instandhaltungs-Rücklage-Planer — Langfristige Rücklagenplanung
 * Pro Objekt: Wann steht welche Sanierung an? Wie viel Rücklage ist nötig?
 * Peterssche Formel und individuelle Planung.
 */
import { memo, useMemo, useState, useCallback } from "react";
import { Wrench, Plus, ChevronDown, ChevronUp, AlertTriangle, Calendar, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProperties } from "@/context/PropertyContext";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

interface MaintenanceItem {
  id: string;
  component: string;
  lastRenewal: number; // year
  lifespan: number; // years
  estimatedCost: number;
  nextDue: number; // year
  urgency: "akut" | "bald" | "geplant" | "ok";
}

interface PropertyMaintenance {
  propertyId: string;
  name: string;
  items: MaintenanceItem[];
  petersRuecklage: number; // monthly
  totalUpcoming5Years: number;
  totalUpcoming10Years: number;
}

const DEFAULT_COMPONENTS = [
  { component: "Dach", lifespan: 40, cost: 25000 },
  { component: "Fassade/Außenputz", lifespan: 30, cost: 15000 },
  { component: "Fenster", lifespan: 25, cost: 12000 },
  { component: "Heizungsanlage", lifespan: 20, cost: 10000 },
  { component: "Elektroinstallation", lifespan: 30, cost: 8000 },
  { component: "Wasserleitung", lifespan: 35, cost: 6000 },
  { component: "Sanitäranlagen", lifespan: 20, cost: 5000 },
  { component: "Bodenbeläge", lifespan: 15, cost: 4000 },
  { component: "Außenanlagen", lifespan: 15, cost: 3000 },
  { component: "Aufzug (falls vorhanden)", lifespan: 25, cost: 20000 },
];

const STORAGE_KEY = "immo_maintenance_plans";

const InstandhaltungsRuecklagePlaner = memo(() => {
  const { properties } = useProperties();
  const [expanded, setExpanded] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [customItems, setCustomItems] = useState<Record<string, MaintenanceItem[]>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  });

  const plans = useMemo((): PropertyMaintenance[] => {
    const currentYear = new Date().getFullYear();

    return properties.map((p) => {
      const yearBuilt = p.yearBuilt || 2000;
      const stored = customItems[p.id] || [];

      // Generate default items if none stored
      const items: MaintenanceItem[] = stored.length > 0 ? stored : DEFAULT_COMPONENTS.map((c) => {
        const lastRenewal = yearBuilt;
        const nextDue = lastRenewal + c.lifespan;
        const yearsUntilDue = nextDue - currentYear;
        const urgency: MaintenanceItem["urgency"] =
          yearsUntilDue <= 0 ? "akut" :
          yearsUntilDue <= 3 ? "bald" :
          yearsUntilDue <= 10 ? "geplant" : "ok";

        return {
          id: crypto.randomUUID(),
          component: c.component,
          lastRenewal,
          lifespan: c.lifespan,
          estimatedCost: c.cost,
          nextDue,
          urgency,
        };
      });

      // Peterssche Formel: 1.5% of Herstellungskosten per year
      const herstellungskosten = p.purchasePrice * 0.75; // Building value only
      const petersRuecklage = (herstellungskosten * 0.015) / 12; // Monthly

      const totalUpcoming5Years = items
        .filter((i) => i.nextDue <= currentYear + 5)
        .reduce((s, i) => s + i.estimatedCost, 0);

      const totalUpcoming10Years = items
        .filter((i) => i.nextDue <= currentYear + 10)
        .reduce((s, i) => s + i.estimatedCost, 0);

      return {
        propertyId: p.id,
        name: p.name,
        items: items.sort((a, b) => a.nextDue - b.nextDue),
        petersRuecklage,
        totalUpcoming5Years,
        totalUpcoming10Years,
      };
    });
  }, [properties, customItems]);

  const selectedPlan = plans.find((p) => p.propertyId === selectedProperty);

  const totals = useMemo(() => {
    return {
      monthlyReserve: plans.reduce((s, p) => s + p.petersRuecklage, 0),
      upcoming5Years: plans.reduce((s, p) => s + p.totalUpcoming5Years, 0),
      upcoming10Years: plans.reduce((s, p) => s + p.totalUpcoming10Years, 0),
      akutCount: plans.reduce((s, p) => s + p.items.filter((i) => i.urgency === "akut").length, 0),
    };
  }, [plans]);

  if (properties.length === 0) return null;

  return (
    <div className="gradient-card rounded-xl border border-border p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Instandhaltungs-Rücklage</h3>
          {totals.akutCount > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5">{totals.akutCount} akut</Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[10px] text-muted-foreground">Rücklage/M</p>
          <p className="text-xs font-bold text-primary">{formatCurrency(totals.monthlyReserve)}</p>
          <p className="text-[8px] text-muted-foreground">Peterssche Formel</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[10px] text-muted-foreground">Nächste 5J</p>
          <p className="text-xs font-bold text-gold">{formatCurrency(totals.upcoming5Years)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-[10px] text-muted-foreground">Nächste 10J</p>
          <p className="text-xs font-bold">{formatCurrency(totals.upcoming10Years)}</p>
        </div>
      </div>

      {/* Property selector */}
      {expanded && (
        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger className="h-7 text-[10px] mb-3">
            <SelectValue placeholder="Objekt für Details wählen" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Per-property overview */}
      {!selectedPlan && (
        <div className="space-y-1.5">
          {plans.slice(0, expanded ? undefined : 3).map((plan) => {
            const akutItems = plan.items.filter((i) => i.urgency === "akut" || i.urgency === "bald");
            return (
              <div key={plan.propertyId} className="p-2 rounded-lg bg-background/50 border border-border/50 text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{plan.name}</span>
                  <span className="text-primary font-medium">{formatCurrency(plan.petersRuecklage)}/M</span>
                </div>
                {akutItems.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {akutItems.slice(0, 3).map((item) => (
                      <Badge key={item.id} variant="outline" className={`text-[8px] h-4 ${
                        item.urgency === "akut" ? "text-loss border-loss/30" : "text-gold border-gold/30"
                      }`}>
                        {item.component} ({item.nextDue})
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Selected property detail */}
      {selectedPlan && expanded && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {selectedPlan.items.map((item) => (
            <div key={item.id} className={`flex items-center gap-2 p-1.5 rounded text-[10px] ${
              item.urgency === "akut" ? "bg-loss/5" :
              item.urgency === "bald" ? "bg-gold/5" :
              "bg-background/50"
            }`}>
              {item.urgency === "akut" ? <AlertTriangle className="h-3 w-3 text-loss shrink-0" /> :
               item.urgency === "bald" ? <AlertTriangle className="h-3 w-3 text-gold shrink-0" /> :
               <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />}
              <span className="flex-1">{item.component}</span>
              <span className="text-muted-foreground">{item.nextDue}</span>
              <span className="font-medium">{formatCurrency(item.estimatedCost)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
InstandhaltungsRuecklagePlaner.displayName = "InstandhaltungsRuecklagePlaner";

export { InstandhaltungsRuecklagePlaner };
