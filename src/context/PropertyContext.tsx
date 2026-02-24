import { createContext, useContext, useCallback, useMemo, ReactNode } from "react";
import { Property } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface PortfolioStats {
  totalValue: number;
  totalPurchase: number;
  totalRent: number;
  totalCashflow: number;
  totalDebt: number;
  totalUnits: number;
  equity: number;
  propertyCount: number;
  appreciation: number;
  avgRendite: number;
}

interface PropertyContextType {
  properties: Property[];
  loading: boolean;
  stats: PortfolioStats;
  addProperty: (property: Omit<Property, "id">) => Promise<void>;
  updateProperty: (id: string, property: Partial<Omit<Property, "id">>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  duplicateProperty: (id: string) => Promise<void>;
  getProperty: (id: string) => Property | undefined;
  /** @deprecated Use `stats` instead */
  getStats: () => PortfolioStats;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

const FIELD_MAP: Record<string, string> = {
  name: "name", location: "location", address: "address", type: "type",
  units: "units", purchasePrice: "purchase_price", purchaseDate: "purchase_date",
  currentValue: "current_value", monthlyRent: "monthly_rent", monthlyExpenses: "monthly_expenses",
  monthlyCreditRate: "monthly_credit_rate", monthlyCashflow: "monthly_cashflow",
  remainingDebt: "remaining_debt", interestRate: "interest_rate", sqm: "sqm",
  yearBuilt: "year_built", ownership: "ownership",
};

const mapDbToProperty = (row: any): Property => ({
  id: row.id,
  name: row.name,
  location: row.location,
  address: row.address,
  type: row.type,
  units: row.units,
  purchasePrice: Number(row.purchase_price),
  purchaseDate: row.purchase_date,
  currentValue: Number(row.current_value),
  monthlyRent: Number(row.monthly_rent),
  monthlyExpenses: Number(row.monthly_expenses),
  monthlyCreditRate: Number(row.monthly_credit_rate),
  monthlyCashflow: Number(row.monthly_cashflow),
  remainingDebt: Number(row.remaining_debt),
  interestRate: Number(row.interest_rate),
  sqm: Number(row.sqm),
  yearBuilt: row.year_built,
  ownership: row.ownership as "privat" | "egbr",
});

const mapPropertyToDb = (property: Partial<Omit<Property, "id">>): Record<string, any> => {
  const updates: Record<string, any> = {};
  for (const [key, value] of Object.entries(property)) {
    if (value !== undefined && FIELD_MAP[key]) updates[FIELD_MAP[key]] = value;
  }
  return updates;
};

const EMPTY_STATS: PortfolioStats = {
  totalValue: 0, totalPurchase: 0, totalRent: 0, totalCashflow: 0,
  totalDebt: 0, totalUnits: 0, equity: 0, propertyCount: 0,
  appreciation: 0, avgRendite: 0,
};

const fetchPropertiesFromDb = async () => {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDbToProperty);
};

export const PropertyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: properties = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.properties.all,
    queryFn: fetchPropertiesFromDb,
    enabled: !!user,
  });

  const stats = useMemo<PortfolioStats>(() => {
    if (properties.length === 0) return EMPTY_STATS;
    const acc = properties.reduce(
      (s, p) => ({
        totalValue: s.totalValue + p.currentValue,
        totalPurchase: s.totalPurchase + p.purchasePrice,
        totalRent: s.totalRent + p.monthlyRent,
        totalCashflow: s.totalCashflow + p.monthlyCashflow,
        totalDebt: s.totalDebt + p.remainingDebt,
        totalUnits: s.totalUnits + p.units,
      }),
      { totalValue: 0, totalPurchase: 0, totalRent: 0, totalCashflow: 0, totalDebt: 0, totalUnits: 0 }
    );
    const equity = acc.totalValue - acc.totalDebt;
    return {
      ...acc, equity,
      propertyCount: properties.length,
      appreciation: acc.totalPurchase > 0 ? ((acc.totalValue - acc.totalPurchase) / acc.totalPurchase) * 100 : 0,
      avgRendite: acc.totalPurchase > 0 ? (acc.totalRent * 12) / acc.totalPurchase * 100 : 0,
    };
  }, [properties]);

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: queryKeys.properties.all }), [qc]);

  const addMutation = useMutation({
    mutationFn: async (property: Omit<Property, "id">) => {
      if (!user) throw new Error("Not authenticated");
      const dbFields = mapPropertyToDb(property);
      const { error } = await supabase.from("properties").insert({
        user_id: user.id,
        name: dbFields.name || property.name,
        location: dbFields.location || property.location,
        address: dbFields.address || property.address,
        type: dbFields.type || property.type,
        units: dbFields.units ?? property.units,
        purchase_price: dbFields.purchase_price ?? property.purchasePrice,
        purchase_date: dbFields.purchase_date || property.purchaseDate,
        current_value: dbFields.current_value ?? property.currentValue,
        monthly_rent: dbFields.monthly_rent ?? property.monthlyRent,
        monthly_expenses: dbFields.monthly_expenses ?? property.monthlyExpenses,
        monthly_credit_rate: dbFields.monthly_credit_rate ?? property.monthlyCreditRate,
        monthly_cashflow: dbFields.monthly_cashflow ?? property.monthlyCashflow,
        remaining_debt: dbFields.remaining_debt ?? property.remainingDebt,
        interest_rate: dbFields.interest_rate ?? property.interestRate,
        sqm: dbFields.sqm ?? property.sqm,
        year_built: dbFields.year_built ?? property.yearBuilt,
        ownership: dbFields.ownership || property.ownership,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Fehler beim Anlegen"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, property }: { id: string; property: Partial<Omit<Property, "id">> }) => {
      const updates = mapPropertyToDb(property);
      if (Object.keys(updates).length === 0) return;
      const { error } = await supabase.from("properties").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const addProperty = useCallback(async (property: Omit<Property, "id">) => {
    await addMutation.mutateAsync(property);
  }, [addMutation]);

  const updateProperty = useCallback(async (id: string, property: Partial<Omit<Property, "id">>) => {
    await updateMutation.mutateAsync({ id, property });
  }, [updateMutation]);

  const deleteProperty = useCallback(async (id: string) => {
    await deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  const duplicateProperty = useCallback(async (id: string) => {
    const source = properties.find((p) => p.id === id);
    if (!source || !user) return;
    const { id: _, ...rest } = source;
    await addProperty({ ...rest, name: `${rest.name} (Kopie)` });
  }, [properties, user, addProperty]);

  const getProperty = useCallback((id: string) => properties.find((p) => p.id === id), [properties]);
  const getStats = useCallback(() => stats, [stats]);

  return (
    <PropertyContext.Provider value={{ properties, loading, stats, addProperty, updateProperty, deleteProperty, duplicateProperty, getProperty, getStats }}>
      {children}
    </PropertyContext.Provider>
  );
};

export const useProperties = () => {
  const ctx = useContext(PropertyContext);
  if (!ctx) throw new Error("useProperties must be used within PropertyProvider");
  return ctx;
};
