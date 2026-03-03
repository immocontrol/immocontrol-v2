/**
 * #13: Historische Daten-Snapshots — Monthly KPI snapshot hook.
 * Stores monthly portfolio snapshots in localStorage for trend analysis.
 * Captures: total value, equity, rent, cashflow, yield, vacancy rate, LTV.
 */
import { useEffect, useMemo, useCallback } from "react";

interface PortfolioStats {
  totalValue: number;
  equity: number;
  totalRent: number;
  totalCashflow: number;
  totalDebt: number;
  avgRendite: number;
  propertyCount: number;
  totalUnits: number;
}

export interface PortfolioSnapshot {
  month: string; // "YYYY-MM"
  timestamp: string;
  totalValue: number;
  equity: number;
  monthlyRent: number;
  monthlyCashflow: number;
  totalDebt: number;
  avgYield: number;
  propertyCount: number;
  totalUnits: number;
  ltv: number;
}

const STORAGE_KEY = "immocontrol_portfolio_snapshots";
const MAX_SNAPSHOTS = 60; // 5 years of monthly data

function loadSnapshots(): PortfolioSnapshot[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as PortfolioSnapshot[];
  } catch { /* ignore */ }
  return [];
}

function saveSnapshots(snapshots: PortfolioSnapshot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots.slice(-MAX_SNAPSHOTS)));
}

export function usePortfolioSnapshots(stats: PortfolioStats) {
  const snapshots = useMemo(() => loadSnapshots(), []);

  /* Auto-capture monthly snapshot */
  useEffect(() => {
    if (stats.propertyCount === 0) return;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const existing = snapshots.find((s) => s.month === currentMonth);
    if (existing) return; // Already captured this month

    const snapshot: PortfolioSnapshot = {
      month: currentMonth,
      timestamp: now.toISOString(),
      totalValue: stats.totalValue,
      equity: stats.equity,
      monthlyRent: stats.totalRent,
      monthlyCashflow: stats.totalCashflow,
      totalDebt: stats.totalDebt,
      avgYield: stats.avgRendite,
      propertyCount: stats.propertyCount,
      totalUnits: stats.totalUnits,
      ltv: stats.totalValue > 0 ? (stats.totalDebt / stats.totalValue) * 100 : 0,
    };

    const updated = [...snapshots, snapshot];
    saveSnapshots(updated);
  }, [stats, snapshots]);

  /** Get trend data for charts */
  const trendData = useMemo(() => {
    return snapshots.map((s) => ({
      month: s.month,
      label: new Date(s.month + "-01").toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
      value: s.totalValue,
      equity: s.equity,
      rent: s.monthlyRent,
      cashflow: s.monthlyCashflow,
      yield: s.avgYield,
      ltv: s.ltv,
    }));
  }, [snapshots]);

  /** Month-over-month changes */
  const monthlyChanges = useMemo(() => {
    if (snapshots.length < 2) return null;
    const current = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];
    return {
      valueChange: current.totalValue - previous.totalValue,
      valueChangePct: previous.totalValue > 0 ? ((current.totalValue - previous.totalValue) / previous.totalValue) * 100 : 0,
      equityChange: current.equity - previous.equity,
      rentChange: current.monthlyRent - previous.monthlyRent,
      cashflowChange: current.monthlyCashflow - previous.monthlyCashflow,
    };
  }, [snapshots]);

  /** Manually add a snapshot for a specific month (e.g. import historical data) */
  const addSnapshot = useCallback((snapshot: PortfolioSnapshot) => {
    const existing = snapshots.findIndex((s) => s.month === snapshot.month);
    const updated = [...snapshots];
    if (existing >= 0) {
      updated[existing] = snapshot;
    } else {
      updated.push(snapshot);
      updated.sort((a, b) => a.month.localeCompare(b.month));
    }
    saveSnapshots(updated);
  }, [snapshots]);

  return { snapshots, trendData, monthlyChanges, addSnapshot };
}
