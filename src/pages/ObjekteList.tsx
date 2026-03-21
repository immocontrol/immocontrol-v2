/**
 * ObjekteList — reine Objektliste unter /objekte.
 * Klare IA und Verlinkbarkeit (Vorschlag 16).
 * VirtualList ab 25 Objekten für bessere Performance.
 * UX: Filter/Sort in sessionStorage, damit Zurück-Kontext erhalten bleibt.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderMain, PageHeaderTitle } from "@/components/ui/page-header";
import { ROUTES } from "@/lib/routes";
import { calcBruttoRendite, calcNettoRendite } from "@/lib/calculations";

const VIRTUAL_LIST_THRESHOLD = 25;
const PROPERTY_CARD_HEIGHT = 220;
const LIST_STATE_KEY = "immocontrol_objekte_list";

type SortType = "name" | "value" | "rent" | "cashflow" | "rendite" | "netto";

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "value", label: "Wert" },
  { value: "rent", label: "Miete" },
  { value: "cashflow", label: "Cashflow" },
  { value: "rendite", label: "Brutto-Rendite" },
  { value: "netto", label: "Netto-Rendite" },
];

function loadListState(): { search: string; sort: SortType } {
  try {
    const raw = sessionStorage.getItem(LIST_STATE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { search?: string; sort?: string };
      const sort = p.sort && ["name", "value", "rent", "cashflow", "rendite", "netto"].includes(p.sort) ? p.sort as SortType : "name";
      return { search: typeof p.search === "string" ? p.search : "", sort };
    }
  } catch { /* ignore */ }
  return { search: "", sort: "name" };
}

const ObjekteList = () => {
  const { properties, loading } = useProperties();
  const navigate = useNavigate();
  const [search, setSearch] = useState(() => loadListState().search);
  const [sort, setSort] = useState<SortType>(() => loadListState().sort);

  useEffect(() => {
    document.title = `Objekte (${properties.length}) – ImmoControl`;
    return () => { document.title = "ImmoControl"; };
  }, [properties.length]);

  useEffect(() => {
    sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify({ search, sort }));
  }, [search, sort]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth < 768) return;
    const t = setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 400);
    return () => clearTimeout(t);
  }, []);

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
      <div className="p-4 md:p-6 space-y-4 min-w-0" role="status" aria-label="Objekte werden geladen">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="h-7 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-36 bg-muted/70 animate-pulse rounded" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-9 w-56 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-28 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex justify-between gap-2">
                <div className="h-5 bg-muted animate-pulse rounded w-2/3" />
                <div className="h-5 w-12 bg-muted animate-pulse rounded shrink-0" />
              </div>
              <div className="h-4 bg-muted/80 animate-pulse rounded w-full" />
              <div className="flex gap-2">
                <div className="h-6 w-14 bg-muted/70 animate-pulse rounded" />
                <div className="h-6 w-20 bg-muted/70 animate-pulse rounded" />
              </div>
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-10 bg-muted/60 animate-pulse rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 min-w-0 overflow-x-hidden">
      <PageHeader>
        <PageHeaderMain>
          <PageHeaderTitle>
            <Building2 className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            Objekte
          </PageHeaderTitle>
          <PageHeaderDescription>
            {properties.length} {properties.length === 1 ? "Objekt" : "Objekte"} im Portfolio
          </PageHeaderDescription>
        </PageHeaderMain>
        <PageHeaderActions>
          <div className="relative flex-1 sm:min-w-[200px] max-w-sm min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
            <Input
              ref={searchInputRef}
              placeholder="z. B. Musterstraße oder Objektname"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 shadow-sm"
              aria-label="Objekte durchsuchen"
            />
          </div>
          {search.trim() && (
            <span className="text-xs text-muted-foreground whitespace-nowrap self-center" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? "Treffer" : "Treffer"}
            </span>
          )}
          <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
            <SelectTrigger className="h-9 w-[min(100%,11rem)] min-w-[9.5rem] text-sm shadow-sm" aria-label="Sortierung">
              <SelectValue placeholder="Sortierung" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PropertyComparison />
          <AddPropertyDialog />
        </PageHeaderActions>
      </PageHeader>

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
          title={search ? "Keine Treffer" : "Noch keine Objekte"}
          description={
            search
              ? `Keine Objekte für „${search}". Suche zurücksetzen oder neues Objekt anlegen.`
              : "Lege dein erstes Objekt an – dann siehst du hier dein Portfolio mit Wert, Miete und Rendite."
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {search && (
                <Button variant="outline" size="sm" className="touch-target min-h-[44px]" onClick={() => setSearch("")}>
                  Suche zurücksetzen
                </Button>
              )}
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
