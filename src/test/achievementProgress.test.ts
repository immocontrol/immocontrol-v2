import { describe, expect, it } from "vitest";
import { getAchievementLockedHint, type AchievementProgressContext } from "@/lib/achievementProgress";

const emptyCtx = (): AchievementProgressContext => ({
  totalUnits: 0,
  propertyCount: 0,
  properties: [],
  dealsCount: 0,
  dealsAbgeschlossenCount: 0,
  tenantsCount: 0,
  viewingsCount: 0,
  documentsCount: 0,
  occupancyPct: 0,
  streak: 0,
  goalsReachedCount: 0,
  totalCashflow: 0,
  equity: 0,
  avgRendite: 0,
});

describe("getAchievementLockedHint", () => {
  it("zeigt MFH-Fortschritt anhand Objekttypen", () => {
    const ctx = emptyCtx();
    ctx.properties = [{ type: "haus" }];
    expect(getAchievementLockedHint("first_mfh", ctx)).toBe("0 / 1 MFH");
    ctx.properties = [{ type: "MFH" }];
    expect(getAchievementLockedHint("first_mfh", ctx)).toBe("1 / 1 MFH");
  });

  it("zeigt ETW-Fortschritt anhand Objekttypen", () => {
    const ctx = emptyCtx();
    ctx.properties = [{ type: "etw" }];
    expect(getAchievementLockedHint("first_etw", ctx)).toBe("1 / 1 ETW");
  });

  it("gibt bei positivem Cashflow keinen Hinweis für Ziel >0", () => {
    const ctx = emptyCtx();
    ctx.totalCashflow = 100;
    expect(getAchievementLockedHint("positive_cashflow", ctx)).toBeNull();
  });

  it("gibt bei nicht positivem Cashflow einen Hinweis", () => {
    const ctx = emptyCtx();
    ctx.totalCashflow = -50;
    const hint = getAchievementLockedHint("positive_cashflow", ctx);
    expect(hint).toContain("-50");
    expect(hint).toContain("Ziel");
  });

  it("zeigt Fortschritt für erste Objekte und Deals", () => {
    expect(getAchievementLockedHint("first_property", { ...emptyCtx(), propertyCount: 1 })).toBe("1 / 1 Objekt");
    expect(getAchievementLockedHint("first_deal_done", { ...emptyCtx(), dealsAbgeschlossenCount: 0 })).toBe(
      "0 / 1 abgeschlossener Deal"
    );
  });
});
