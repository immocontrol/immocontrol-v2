/**
 * Fortschrittstext für gesperrte Achievements (Gamification).
 */

export interface AchievementProgressContext {
  totalUnits: number;
  propertyCount: number;
  properties: { type?: string }[];
  dealsCount: number;
  dealsAbgeschlossenCount: number;
  tenantsCount: number;
  viewingsCount: number;
  documentsCount: number;
  occupancyPct: number;
  streak: number;
  goalsReachedCount: number;
  totalCashflow: number;
  equity: number;
  avgRendite: number;
}

export function getAchievementLockedHint(id: string, ctx: AchievementProgressContext): string | null {
  const hasMfh = ctx.properties.some((p) => (p.type || "").toUpperCase() === "MFH");
  const hasEtw = ctx.properties.some((p) => (p.type || "").toUpperCase() === "ETW");

  switch (id) {
    case "first_property":
      return `${Math.min(ctx.propertyCount, 1)} / 1 Objekt`;
    case "first_mfh":
      return hasMfh ? "1 / 1 MFH" : "0 / 1 MFH";
    case "first_etw":
      return hasEtw ? "1 / 1 ETW" : "0 / 1 ETW";
    case "5_units":
      return `${Math.min(ctx.totalUnits, 5)} / 5 Einheiten`;
    case "10_units":
      return `${Math.min(ctx.totalUnits, 10)} / 10 Einheiten`;
    case "25_units":
      return `${Math.min(ctx.totalUnits, 25)} / 25 Einheiten`;
    case "50_units":
      return `${Math.min(ctx.totalUnits, 50)} / 50 Einheiten`;
    case "first_deal_done":
      return `${Math.min(ctx.dealsAbgeschlossenCount, 1)} / 1 abgeschlossener Deal`;
    case "10_deals_pipeline":
      return `${Math.min(ctx.dealsCount, 10)} / 10 Deals`;
    case "first_tenant":
      return `${Math.min(ctx.tenantsCount, 1)} / 1 Mieter`;
    case "occupancy_100":
      return `${ctx.occupancyPct} / 100 % Belegung`;
    case "positive_cashflow":
      return ctx.totalCashflow > 0
        ? null
        : `Aktuell ${Math.round(ctx.totalCashflow)} €/M · Ziel: > 0 €`;
    case "cashflow_1k":
      return `${Math.round(Math.min(ctx.totalCashflow, 1000))} / 1000 €`;
    case "equity_100k":
      return `${Math.round(Math.min(ctx.equity, 100000))} / 100000 €`;
    case "equity_500k":
      return `${Math.round(Math.min(ctx.equity, 500000))} / 500000 €`;
    case "rendite_5":
      return `${Math.min(Math.round(ctx.avgRendite ?? 0), 5)} / 5 %`;
    case "first_document":
      return `${Math.min(ctx.documentsCount, 1)} / 1 Dokument`;
    case "first_viewing":
      return `${Math.min(ctx.viewingsCount, 1)} / 1 Besichtigung`;
    case "first_goal_reached":
      return `${Math.min(ctx.goalsReachedCount, 1)} / 1 Ziel erreicht`;
    case "streak_7":
      return `${Math.min(ctx.streak, 7)} / 7 Tage`;
    default:
      return null;
  }
}
