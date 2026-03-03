/**
 * useDashboardStats — extracted from Dashboard.tsx for code splitting.
 * Computes portfolio metrics, performer rankings, and vacancy analysis.
 */
import { useMemo } from "react";
import { safeDivide } from "@/lib/formatters";

interface Property {
  id: string;
  name: string;
  address: string | null;
  type: string;
  units: number;
  purchasePrice: number;
  currentValue: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyCreditRate: number;
  monthlyCashflow: number;
  remainingDebt: number;
  interestRate: number;
  sqm: number;
  yearBuilt: number;
  ownership: string;
  purchaseDate?: string;
}

interface PortfolioStats {
  propertyCount: number;
  totalUnits: number;
  totalValue: number;
  totalPurchase: number;
  totalRent: number;
  totalExpenses: number;
  totalCreditRate: number;
  totalCashflow: number;
  totalDebt: number;
  totalSqm: number;
  equity: number;
  avgRendite: number;
  appreciation: number;
}

interface TenantRecord {
  property_id: string;
  is_active: boolean;
  monthly_rent: number;
}

export function useDashboardStats(
  properties: Property[],
  stats: PortfolioStats,
  allTenants: TenantRecord[],
) {
  /** Best performer by cashflow */
  const bestPerformer = useMemo(() => {
    if (properties.length === 0) return null;
    return properties.reduce((best, p) => p.monthlyCashflow > best.monthlyCashflow ? p : best, properties[0]);
  }, [properties]);

  /** Worst performer by cashflow */
  const worstPerformer = useMemo(() => {
    if (properties.length === 0) return null;
    return properties.reduce((worst, p) => p.monthlyCashflow < worst.monthlyCashflow ? p : worst, properties[0]);
  }, [properties]);

  /** Filter counts by ownership type */
  const filterCounts = useMemo(() => ({
    egbr: properties.filter(p => p.ownership === "egbr").length,
    privat: properties.filter(p => p.ownership === "privat").length,
  }), [properties]);

  /** Portfolio summary metrics */
  const portfolioMetrics = useMemo(() => {
    const totalRentPerSqm = safeDivide(stats.totalRent, stats.totalSqm, 0);
    const avgValuePerUnit = safeDivide(stats.totalValue, stats.totalUnits, 0);
    const debtToEquityRatio = safeDivide(stats.totalDebt, stats.equity, 0);
    const annualCashflow = stats.totalCashflow * 12;
    const cashOnCashReturn = safeDivide(annualCashflow * 100, stats.equity, 0);
    return { totalRentPerSqm, avgValuePerUnit, debtToEquityRatio, annualCashflow, cashOnCashReturn };
  }, [stats]);

  /** Property count by type */
  const propertyTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    properties.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
    return counts;
  }, [properties]);

  /** Vacant properties (no active tenants) */
  const vacantProperties = useMemo(() => {
    return properties.filter(p => {
      const propTenants = allTenants.filter(t => t.property_id === p.id && t.is_active);
      return propTenants.length === 0;
    });
  }, [properties, allTenants]);

  /** Total rent from active tenants */
  const totalTenantRent = useMemo(() => {
    return allTenants.filter(t => t.is_active).reduce((s, t) => s + (t.monthly_rent || 0), 0);
  }, [allTenants]);

  /** Average holding period in months */
  const avgHoldingPeriodMonths = useMemo(() => {
    if (properties.length === 0) return 0;
    const totalMonths = properties.reduce((s, p) => {
      if (!p.purchaseDate) return s;
      const months = Math.floor((Date.now() - new Date(p.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
      return s + months;
    }, 0);
    const raw = totalMonths / properties.length;
    return Number.isFinite(raw) ? Math.round(raw) : 0;
  }, [properties]);

  /** Highest and lowest yield properties */
  const yieldExtremes = useMemo(() => {
    if (properties.length === 0) return { highest: null, lowest: null };
    const withYield = properties.map(p => ({
      ...p,
      yieldPct: p.purchasePrice > 0 ? (p.monthlyRent * 12 / p.purchasePrice * 100) : 0,
    }));
    const sorted = [...withYield].sort((a, b) => b.yieldPct - a.yieldPct);
    return { highest: sorted[0], lowest: sorted[sorted.length - 1] };
  }, [properties]);

  /** Vacancy rate */
  const totalUnitsFromProps = properties.reduce((s, p) => s + p.units, 0);
  const occupiedUnits = allTenants.filter(t => t.is_active).length;
  const vacancyRate = totalUnitsFromProps > 0 ? ((totalUnitsFromProps - occupiedUnits) / totalUnitsFromProps * 100) : 0;

  /** LTV ratio */
  const portfolioLTV = stats.totalValue > 0 ? (stats.totalDebt / stats.totalValue * 100) : 0;

  /** Top 3 by cashflow */
  const top3Cashflow = useMemo(() => {
    return [...properties].sort((a, b) => b.monthlyCashflow - a.monthlyCashflow).slice(0, 3);
  }, [properties]);

  return {
    bestPerformer,
    worstPerformer,
    filterCounts,
    portfolioMetrics,
    propertyTypeCounts,
    vacantProperties,
    totalTenantRent,
    avgHoldingPeriodMonths,
    yieldExtremes,
    vacancyRate,
    portfolioLTV,
    top3Cashflow,
  };
}
