import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeStreakFromDates } from "@/hooks/useUserActivity";

describe("computeStreakFromDates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("liefert 0 wenn heute kein Aktivitätstag ist", () => {
    expect(computeStreakFromDates(["2025-06-14", "2025-06-13"])).toBe(0);
  });

  it("zählt aufeinanderfolgende Tage bis heute (Reihenfolge der Liste egal)", () => {
    const dates = ["2025-06-13", "2025-06-15", "2025-06-14"];
    expect(computeStreakFromDates(dates)).toBe(3);
  });

  it("bricht bei Lücke im Kalender ab", () => {
    expect(computeStreakFromDates(["2025-06-15", "2025-06-13"])).toBe(1);
  });

  it("nur heute zählt als 1", () => {
    expect(computeStreakFromDates(["2025-06-15"])).toBe(1);
  });
});
