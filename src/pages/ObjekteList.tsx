/**
 * ObjekteList — reine Objektliste unter /objekte.
 * Klare IA und Verlinkbarkeit (Vorschlag 16).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Search } from "lucide-react";
import { useProperties } from "@/context/PropertyContext";
import PropertyCard from "@/components/PropertyCard";
import AddPropertyDialog from "@/components/AddPropertyDialog";
import EmptyState from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

type SortType = "name" | "value" | "rent" | "cashflow";

const ObjekteList = () => {
  const { properties, loading } = useProperties();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortType>("name");

  const filtered = properties.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.address && p.address.toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "name":
        return (a.name || "").localeCompare(b.name || "");
      case "value":
        return (b.currentValue ?? 0) - (a.currentValue ?? 0);
      case "rent":
        return (b.monthlyRent ?? 0) - (a.monthlyRent ?? 0);
      case "cashflow":
        return (b.monthlyCashflow ?? 0) - (a.monthlyCashflow ?? 0);
      default:
        return 0;
    }
  });

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
    <div className="p-4 md:p-6 space-y-4" id="main-content">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Objekte
        </h1>
        <div className="flex flex-wrap items-center gap-2">
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
          </select>
          <AddPropertyDialog />
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={search ? "Keine Objekte gefunden" : "Noch keine Objekte"}
          description={
            search
              ? "Suchbegriff anpassen oder Objekt anlegen."
              : "Lege dein erstes Objekt an, um zu starten."
          }
          action={!search ? <AddPropertyDialog /> : undefined}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
          {sorted.map((property) => (
            <li key={property.id}>
              <PropertyCard
                property={property}
                onClick={() => navigate(`${ROUTES.PROPERTY}/${property.id}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ObjekteList;
