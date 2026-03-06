/**
 * Dashboard-Metriken aus Properties, Stats und Tenants — ausgelagert aus Dashboard.tsx (Refactor).
 */
import { useMemo } from "react";
import type { Property } from "@/data/mockData";
import { safeDivide } from "@/lib/formatters";

interface StatsInput {
  totalRent: number;
  totalSqm: number;
  totalValue: number;
  totalUnits: number;
  totalDebt: number;
  equity: number;
  totalCashflow: number;
}

interface TenantRow {
  property_id: string;
  is_active: boolean;
  monthly_rent: number;
}

export function useDashboardMetrics(
  properties: Property[],
  stats: StatsInput,
  allTenants: TenantRow[]
) {
  const portfolioMetrics = useMemo(() => {
    const totalRentPerSqm = safeDivide(stats.totalRent, stats.totalSqm, 0);
    const avgValuePerUnit = safeDivide(stats.totalValue, stats.totalUnits, 0);
    const debtToEquityRatio = safeDivide(stats.totalDebt, stats.equity, 0);
    const annualCashflow = stats.totalCashflow * 12;
    const cashOnCashReturn = safeDivide(annualCashflow * 100, stats.equity, 0);
    return { totalRentPerSqm, avgValuePerUnit, debtToEquityRatio, annualCashflow, cashOnCashReturn };
  }, [stats]);

  const propertyTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    properties.forEach((p) => {
      counts[p.type] = (counts[p.type] || 0) + 1;
    });
    return counts;
  }, [properties]);

  const vacantProperties = useMemo(
    () =>
      properties.filter((p) => {
        const propTenants = allTenants.filter((t) => t.property_id === p.id && t.is_active);
        return propTenants.length === 0;
      }),
    [properties, allTenants]
  );

  const totalTenantRent = useMemo(
    () => allTenants.filter((t) => t.is_active).reduce((s, t) => s + (t.monthly_rent || 0), 0),
    [allTenants]
  );

  const avgHoldingPeriodMonths = useMemo(() => {
    if (properties.length === 0) return 0;
    const totalMonths = properties.reduce((s, p) => {
      if (!p.purchaseDate) return s;
      const months = Math.floor(
        (Date.now() - new Date(p.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      return s + months;
    }, 0);
    const raw = totalMonths / properties.length;
    return Number.isFinite(raw) ? Math.round(raw) : 0;
  }, [properties]);

  const yieldExtremes = useMemo(() => {
    if (properties.length === 0) return { highest: null, lowest: null };
    const withYield = properties.map((p) => ({
      ...p,
      yieldPct:
        p.purchasePrice > 0 ? (p.monthlyRent * 12) / p.purchasePrice * 100 : 0,
    }));
    const sorted = [...withYield].sort((a, b) => b.yieldPct - a.yieldPct);
    return { highest: sorted[0], lowest: sorted[sorted.length - 1] };
  }, [properties]);

  return {
    portfolioMetrics,
    propertyTypeCounts,
    vacantProperties,
    totalTenantRent,
    avgHoldingPeriodMonths,
    yieldExtremes,
  };
}
