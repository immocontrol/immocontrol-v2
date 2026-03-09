/**
 * ObjekteList — reine Objektliste unter /objekte.
 * Klare IA und Verlinkbarkeit (Vorschlag 16).
 * VirtualList ab 25 Objekten für bessere Performance.
 */
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Search, Briefcase, Camera, Store, FileText, PieChart, ShieldAlert } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import PropertyCard from "@/components/PropertyCard";
import AddPropertyDialog from "@/components/AddPropertyDialog";
import { PropertyComparison } from "@/components/PropertyComparison";
import { EmptyState } from "@/components/EmptyState";
import { VirtualList } from "@/components/VirtualList";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { calcBruttoRendite, calcNettoRendite } from "@/lib/calculations";

const VIRTUAL_LIST_THRESHOLD = 25;
const PROPERTY_CARD_HEIGHT = 220;

type SortType = "name" | "value" | "rent" | "cashflow" | "rendite" | "netto";

const ObjekteList = () => {
  const { properties, loading } = useProperties();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortType>("name");

  const filtered = useMemo(
    () =>
      properties.filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.address && p.address.toLowerCase().includes(search.toLowerCase()))
      ),
    [properties, search]
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        switch (sort) {
          case "name":
            return (a.name || "").localeCompare(b.name || "");
          case "value":
            return (b.currentValue ?? 0) - (a.currentValue ?? 0);
          case "rent":
            return (b.monthlyRent ?? 0) - (a.monthlyRent ?? 0);
          case "cashflow":
            return (b.monthlyCashflow ?? 0) - (a.monthlyCashflow ?? 0);
          case "rendite":
            return calcBruttoRendite(b.purchasePrice, b.monthlyRent) - calcBruttoRendite(a.purchasePrice, a.monthlyRent);
          case "netto":
            return calcNettoRendite(b.purchasePrice, b.monthlyRent, b.monthlyExpenses ?? 0) - calcNettoRendite(a.purchasePrice, a.monthlyRent, a.monthlyExpenses ?? 0);
          default:
            return 0;
        }
      }),
    [filtered, sort]
  );

  const renderItem = useCallback(
    (property: (typeof properties)[0]) => (
      <div className="pb-4">
        <PropertyCard
          {...property}
          monthlyExpenses={property.monthlyExpenses}
          monthlyCreditRate={property.monthlyCreditRate}
          ownership={property.ownership}
        />
      </div>
    ),
    []
  );

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 min-w-0 overflow-x-hidden" id="main-content">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between min-w-0">
        <h1 className="text-xl font-semibold flex items-center gap-2 shrink-0">
          <Building2 className="h-5 w-5" />
          Objekte
        </h1>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="relative flex-1 sm:min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortType)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Sortierung"
          >
            <option value="name">Name</option>
            <option value="value">Wert</option>
            <option value="rent">Miete</option>
            <option value="cashflow">Cashflow</option>
            <option value="rendite">Brutto-Rendite</option>
            <option value="netto">Netto-Rendite</option>
          </select>
          <PropertyComparison />
          <AddPropertyDialog />
        </div>
      </div>

      {/* IMP-51: Portfolio-Benchmark (Durchschnitts-Rendite) + Synergien */}
      {sorted.length > 0 && (() => {
        const avgBrutto = sorted.reduce((s, p) => s + calcBruttoRendite(p.purchasePrice, p.monthlyRent), 0) / sorted.length;
        const avgNetto = sorted.reduce((s, p) => s + calcNettoRendite(p.purchasePrice, p.monthlyRent, p.monthlyExpenses ?? 0), 0) / sorted.length;
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Ø Brutto-Rendite: <strong className="text-foreground">{avgBrutto.toFixed(1)}%</strong></span>
            <span>Ø Netto-Rendite: <strong className="text-foreground">{avgNetto.toFixed(1)}%</strong></span>
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => navigate(ROUTES.DIVERSIFIKATION)} className="text-primary hover:underline inline-flex items-center gap-0.5 touch-target min-h-[36px] sm:min-h-0" aria-label="Diversifikation">
                <PieChart className="h-3 w-3" /> Diversifikation
              </button>
              <span className="text-muted-foreground/60">·</span>
              <button type="button" onClick={() => navigate(ROUTES.STRESS_TEST)} className="text-primary hover:underline inline-flex items-center gap-0.5 touch-target min-h-[36px] sm:min-h-0" aria-label="Stress-Test">
                <ShieldAlert className="h-3 w-3" /> Stress-Test
              </button>
            </span>
          </div>
        );
      })()}

      {sorted.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={search ? "Keine Objekte gefunden" : "Noch keine Objekte"}
          description={
            search
              ? "Suchbegriff anpassen oder neues Objekt anlegen."
              : "Lege dein erstes Objekt an – dann siehst du hier dein Portfolio."
          }
          action={
            !search ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <AddPropertyDialog />
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.DEALS)} className="touch-target min-h-[44px] gap-2" aria-label="Zu Deals">
                  <Briefcase className="h-4 w-4" /> Deals
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.BESICHTIGUNGEN)} className="touch-target min-h-[44px] gap-2" aria-label="Zu Besichtigungen">
                  <Camera className="h-4 w-4" /> Besichtigungen
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.CRM_SCOUT)} className="touch-target min-h-[44px] gap-2" aria-label="WGH-Scout">
                  <Store className="h-4 w-4" /> WGH-Scout
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.CONTRACTS)} className="touch-target min-h-[44px] gap-2" aria-label="Zu Verträgen">
                  <FileText className="h-4 w-4" /> Verträge
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : sorted.length > VIRTUAL_LIST_THRESHOLD ? (
        <VirtualList
          items={sorted}
          itemHeight={PROPERTY_CARD_HEIGHT}
          maxHeight={typeof window !== "undefined" ? window.innerHeight - 200 : 600}
          overscan={4}
          getKey={(p) => p.id}
          renderItem={renderItem}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
          {sorted.map((property, i) => (
            <li key={property.id}>
              <PropertyCard
                {...property}
                monthlyExpenses={property.monthlyExpenses}
                monthlyCreditRate={property.monthlyCreditRate}
                ownership={property.ownership}
                delay={i * 60}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ObjekteList;
