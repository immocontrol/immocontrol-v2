/**
 * Gamification: Achievement definitions and check logic.
 * Used by Erfolge page and optional toast on unlock.
 */

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Target,
  Wallet,
  TrendingUp,
  Users,
  FileText,
  Camera,
  Handshake,
  Home,
  Building,
  Flame,
} from "lucide-react";

export type AchievementCategory = "portfolio" | "deals" | "mieter" | "finanzen" | "nutzung";

export interface AchievementContext {
  stats: {
    totalUnits: number;
    propertyCount: number;
    equity: number;
    totalCashflow: number;
    avgRendite: number;
  };
  properties: { type?: string; units?: number }[];
  tenantsCount: number;
  viewingsCount: number;
  documentsCount: number;
  dealsCount: number;
  dealsAbgeschlossenCount: number;
  goalsReachedCount: number;
  /** Belegung in % (100 = alle Einheiten vermietet). */
  occupancyPct?: number;
  /** Login-Streak (Tage in Folge aktiv). */
  streak?: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: AchievementCategory;
  check: (ctx: AchievementContext) => boolean;
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  portfolio: "Portfolio",
  deals: "Deals",
  mieter: "Mieter",
  finanzen: "Finanzen",
  nutzung: "Nutzung",
};

export const ACHIEVEMENT_CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value: value as AchievementCategory,
  label,
}));

export const ACHIEVEMENTS: AchievementDef[] = [
  // Portfolio
  {
    id: "first_property",
    title: "Erstes Objekt",
    description: "Ein Objekt im Portfolio angelegt",
    icon: Building2,
    category: "portfolio",
    check: (ctx) => ctx.stats.propertyCount >= 1,
  },
  {
    id: "5_units",
    title: "5 Einheiten",
    description: "5 Mieteinheiten im Portfolio",
    icon: Building2,
    category: "portfolio",
    check: (ctx) => ctx.stats.totalUnits >= 5,
  },
  {
    id: "10_units",
    title: "10 Einheiten",
    description: "10 Mieteinheiten im Portfolio",
    icon: Building2,
    category: "portfolio",
    check: (ctx) => ctx.stats.totalUnits >= 10,
  },
  {
    id: "25_units",
    title: "25 Einheiten",
    description: "25 Mieteinheiten im Portfolio",
    icon: Building2,
    category: "portfolio",
    check: (ctx) => ctx.stats.totalUnits >= 25,
  },
  {
    id: "50_units",
    title: "50 Einheiten",
    description: "50 Mieteinheiten im Portfolio",
    icon: Building2,
    category: "portfolio",
    check: (ctx) => ctx.stats.totalUnits >= 50,
  },
  {
    id: "first_mfh",
    title: "Erstes MFH",
    description: "Ein Mehrfamilienhaus angelegt",
    icon: Building,
    category: "portfolio",
    check: (ctx) => ctx.properties.some((p) => (p.type || "").toUpperCase() === "MFH"),
  },
  {
    id: "first_etw",
    title: "Erste ETW",
    description: "Eine Eigentumswohnung angelegt",
    icon: Home,
    category: "portfolio",
    check: (ctx) => ctx.properties.some((p) => (p.type || "").toUpperCase() === "ETW"),
  },
  // Deals
  {
    id: "first_deal_done",
    title: "Erster Deal abgeschlossen",
    description: "Ein Deal in „Abgeschlossen“",
    icon: Handshake,
    category: "deals",
    check: (ctx) => ctx.dealsAbgeschlossenCount >= 1,
  },
  {
    id: "10_deals_pipeline",
    title: "10 Deals in der Pipeline",
    description: "10 Deals in Recherche bis Verhandlung",
    icon: Target,
    category: "deals",
    check: (ctx) => ctx.dealsCount >= 10,
  },
  // Mieter
  {
    id: "first_tenant",
    title: "Erster Mieter",
    description: "Mindestens ein Mieter erfasst",
    icon: Users,
    category: "mieter",
    check: (ctx) => ctx.tenantsCount >= 1,
  },
  {
    id: "occupancy_100",
    title: "100 % Belegung",
    description: "Alle Einheiten vermietet",
    icon: Users,
    category: "mieter",
    check: (ctx) => (ctx.occupancyPct ?? 0) >= 100,
  },
  // Finanzen (align with PortfolioMilestones)
  {
    id: "positive_cashflow",
    title: "Positiver Cashflow",
    description: "Monatlicher Cashflow > 0 €",
    icon: Wallet,
    category: "finanzen",
    check: (ctx) => ctx.stats.totalCashflow > 0,
  },
  {
    id: "cashflow_1k",
    title: "1.000 €/Monat Cashflow",
    description: "Monatlicher Cashflow ≥ 1.000 €",
    icon: Wallet,
    category: "finanzen",
    check: (ctx) => ctx.stats.totalCashflow >= 1000,
  },
  {
    id: "equity_100k",
    title: "100k € Eigenkapital",
    description: "Eigenkapital ≥ 100.000 €",
    icon: Target,
    category: "finanzen",
    check: (ctx) => ctx.stats.equity >= 100_000,
  },
  {
    id: "equity_500k",
    title: "500k € Eigenkapital",
    description: "Eigenkapital ≥ 500.000 €",
    icon: Target,
    category: "finanzen",
    check: (ctx) => ctx.stats.equity >= 500_000,
  },
  {
    id: "rendite_5",
    title: "5 % Rendite",
    description: "Durchschnittliche Rendite ≥ 5 %",
    icon: TrendingUp,
    category: "finanzen",
    check: (ctx) => ctx.stats.avgRendite >= 5,
  },
  // Nutzung
  {
    id: "first_document",
    title: "Dokument hochgeladen",
    description: "Mindestens ein Dokument angelegt",
    icon: FileText,
    category: "nutzung",
    check: (ctx) => ctx.documentsCount >= 1,
  },
  {
    id: "first_viewing",
    title: "Erste Besichtigung",
    description: "Mindestens eine Besichtigung erfasst",
    icon: Camera,
    category: "nutzung",
    check: (ctx) => ctx.viewingsCount >= 1,
  },
  {
    id: "first_goal_reached",
    title: "Erstes Ziel erreicht",
    description: "Ein Portfolio-Ziel zu 100 % erfüllt",
    icon: Target,
    category: "nutzung",
    check: (ctx) => ctx.goalsReachedCount >= 1,
  },
  {
    id: "streak_7",
    title: "7 Tage in Folge",
    description: "7 Tage in Folge aktiv eingeloggt",
    icon: Flame,
    category: "nutzung",
    check: (ctx) => (ctx.streak ?? 0) >= 7,
  },
];

export function getCategoryLabel(cat: AchievementCategory): string {
  return CATEGORY_LABELS[cat];
}

export function computeReachedAchievements(ctx: AchievementContext): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.check(ctx));
}

/** Level from total points (derived, no DB). */
export const LEVELS = [
  { minPoints: 0, maxPoints: 4, title: "Starter", emoji: "🌱" },
  { minPoints: 5, maxPoints: 14, title: "Aufsteiger", emoji: "📈" },
  { minPoints: 15, maxPoints: 29, title: "Portfolio-Builder", emoji: "🏗️" },
  { minPoints: 30, maxPoints: 49, title: "Multi-Unit", emoji: "🏢" },
  { minPoints: 50, maxPoints: Infinity, title: "Profi", emoji: "🏆" },
] as const;

export function computePoints(ctx: {
  totalUnits: number;
  propertyCount: number;
  goalsReachedCount: number;
  achievementsReachedCount: number;
}): number {
  return (
    ctx.totalUnits * 1 +
    ctx.propertyCount * 2 +
    ctx.goalsReachedCount * 5 +
    ctx.achievementsReachedCount * 3
  );
}

export function getLevelForPoints(points: number): (typeof LEVELS)[number] {
  const level = LEVELS.find((l) => points >= l.minPoints && points <= l.maxPoints);
  return level ?? LEVELS[0];
}

export function getProgressToNextLevel(points: number): {
  current: (typeof LEVELS)[number];
  next: (typeof LEVELS)[number] | null;
  progressPct: number;
  pointsToNext: number;
} {
  const current = getLevelForPoints(points);
  const idx = LEVELS.indexOf(current);
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
  if (!next) {
    return { current, next: null, progressPct: 100, pointsToNext: 0 };
  }
  const range = next.minPoints - current.minPoints;
  const inLevel = points - current.minPoints;
  const progressPct = Math.min(100, (inLevel / range) * 100);
  const pointsToNext = next.minPoints - points;
  return { current, next, progressPct, pointsToNext };
}
