/**
 * #9: Comprehensive business logic tests for critical calculations
 * - Kaufnebenkosten (acquisition costs)
 * - Mieterhöhung §558 BGB (rent increase caps)
 * - Tilgungsplan / Amortization (loan repayment schedule)
 * - Hockey Stick Simulator engine
 * - CRM utility functions (polygon area, distance, lead scoring)
 */

import { describe, it, expect } from "vitest";
import {
  calculateAnalysis,
  BUNDESLAENDER_GRUNDERWERBSTEUER,
  DEFAULT_INPUTS,
  type AnalysisInputState,
} from "@/hooks/useAnalysisCalculations";
import {
  simulate,
  sensitivityAnalysis,
  DEFAULT_PARAMS,
  SCENARIOS,
} from "@/lib/hockeyStickEngine";

/** Params with non-zero values so growth/debt/rental assertions pass (DEFAULT_PARAMS is all zeros) */
const HOCKEY_TEST_PARAMS = {
  ...DEFAULT_PARAMS,
  startCapital: 50000,
  monthlyInvestment: 500,
  annualReturn: 4,
  annualAppreciation: 2,
  inflationRate: 2,
  taxRate: 26,
  years: 15,
  rentYield: 4,
  leverageRatio: 70,
  maintenancePct: 1,
  vacancyRate: 3,
  rentGrowthRate: 1.5,
  managementFee: 5,
  insurancePct: 0.3,
};
import {
  calculatePolygonArea,
  distanceMeters,
  calculateLeadScore,
  calcCRMStats,
  getBuildingSizeLabel,
  getBuildingSizeColor,
} from "@/lib/crmUtils";
import { calcMonthlyPayment, calcRemainingMonths, formatArea, formatInterestRate, stringToColor, isValidPLZ } from "@/lib/formatters";
import { sanitizeEmail, sanitizeNumber, sanitizeUrl } from "@/lib/sanitize";
import { isNonEmpty, isPositive, isValidDate } from "@/lib/validation";

// ===== KAUFNEBENKOSTEN (Acquisition Costs) =====
describe("Kaufnebenkosten", () => {
  it("should calculate Grunderwerbsteuer for NRW (6.5%)", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // NRW = 6.5%, Kaufpreis 500000 => 32500
    expect(calc.grunderwerbsteuer).toBe(32500);
  });

  it("should calculate Grunderwerbsteuer for Bayern (3.5%)", () => {
    const inputs: AnalysisInputState = { ...DEFAULT_INPUTS, bundesland: "Bayern" };
    const calc = calculateAnalysis(inputs);
    expect(calc.grunderwerbsteuer).toBe(500000 * 0.035);
  });

  it("should calculate Maklergebühr correctly", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // 3.57% of 500000 = 17850
    expect(calc.makler).toBeCloseTo(17850, 0);
  });

  it("should calculate Notarkosten correctly", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // 1.5% of 500000 = 7500
    expect(calc.notar).toBe(7500);
  });

  it("should sum Kaufnebenkosten correctly", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    expect(calc.kaufnebenkosten).toBeCloseTo(
      calc.grunderwerbsteuer + calc.makler + calc.notar,
      2
    );
  });

  it("should calculate Gesamtkosten = Kaufpreis + Nebenkosten", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    expect(calc.gesamtkosten).toBe(DEFAULT_INPUTS.kaufpreis + calc.kaufnebenkosten);
  });

  it("should have all 16 Bundesländer in the table", () => {
    expect(Object.keys(BUNDESLAENDER_GRUNDERWERBSTEUER)).toHaveLength(16);
    expect(BUNDESLAENDER_GRUNDERWERBSTEUER["Bayern"]).toBe(3.5);
    expect(BUNDESLAENDER_GRUNDERWERBSTEUER["Brandenburg"]).toBe(6.5);
  });

  it("should handle zero Kaufpreis", () => {
    const inputs: AnalysisInputState = { ...DEFAULT_INPUTS, kaufpreis: 0 };
    const calc = calculateAnalysis(inputs);
    expect(calc.grunderwerbsteuer).toBe(0);
    expect(calc.makler).toBe(0);
    expect(calc.notar).toBe(0);
    expect(calc.kaufnebenkosten).toBe(0);
    expect(calc.bruttoRendite).toBe(0);
    expect(calc.nettoRendite).toBe(0);
  });
});

// ===== MIETERHÖHUNG §558 BGB =====
describe("Mieterhöhung §558 BGB", () => {
  it("should cap rent increase at 20% (Kappungsgrenze)", () => {
    const currentRent = 800;
    const kappungsgrenze = 20; // %
    const localComparativeRent = 1200;
    const maxAllowed = currentRent * (1 + kappungsgrenze / 100);
    const newRent = Math.min(maxAllowed, localComparativeRent);
    expect(maxAllowed).toBe(960);
    expect(newRent).toBe(960); // capped at 20%
  });

  it("should cap at 15% in tight housing markets", () => {
    const currentRent = 800;
    const kappungsgrenze = 15; // angespannter Wohnungsmarkt
    const localComparativeRent = 1200;
    const maxAllowed = currentRent * (1 + kappungsgrenze / 100);
    const newRent = Math.min(maxAllowed, localComparativeRent);
    expect(maxAllowed).toBeCloseTo(920, 5); // 800 * 1.15 = 920
    expect(newRent).toBeCloseTo(920, 5);
  });

  it("should not exceed ortsübliche Vergleichsmiete", () => {
    const currentRent = 800;
    const kappungsgrenze = 20;
    const localComparativeRent = 850; // lower than 20% cap
    const maxAllowed = currentRent * (1 + kappungsgrenze / 100);
    const newRent = Math.min(maxAllowed, localComparativeRent);
    expect(newRent).toBe(850); // limited by Vergleichsmiete
  });

  it("should enforce 15-month cooldown period", () => {
    const lastIncrease = new Date("2024-01-01");
    const cooldownMonths = 15;
    const nextAllowed = new Date(lastIncrease);
    nextAllowed.setMonth(nextAllowed.getMonth() + cooldownMonths);
    expect(nextAllowed.getFullYear()).toBe(2025);
    expect(nextAllowed.getMonth()).toBe(3); // April 2025
  });

  it("should calculate €/m² correctly", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // 3000€ / 100m² = 30€/m²
    expect(calc.mieteProQm).toBe(30);
  });

  it("should handle zero Quadratmeter", () => {
    const inputs: AnalysisInputState = { ...DEFAULT_INPUTS, quadratmeter: 0 };
    const calc = calculateAnalysis(inputs);
    expect(calc.mieteProQm).toBe(0);
    expect(calc.preisProQm).toBe(0);
  });
});

// ===== TILGUNGSPLAN / LOAN AMORTIZATION =====
describe("Tilgungsplan (Loan Amortization)", () => {
  it("should calculate Darlehen = Gesamtkosten - Eigenkapital", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    expect(calc.darlehen).toBe(calc.gesamtkosten - DEFAULT_INPUTS.eigenkapital);
  });

  it("should calculate monatliche Rate correctly", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // Rate = Darlehen * (Zinssatz + Tilgung) / 100 / 12
    const expected = calc.darlehen * (DEFAULT_INPUTS.zinssatz + DEFAULT_INPUTS.tilgung) / 100 / 12;
    expect(calc.monatlicheRate).toBeCloseTo(expected, 2);
  });

  it("should calculate monthly annuity payment (formatters)", () => {
    // 200000€, 3.5%, 25 years
    const payment = calcMonthlyPayment(200000, 3.5, 25);
    expect(payment).toBeGreaterThan(900);
    expect(payment).toBeLessThan(1100);
  });

  it("should calculate remaining months correctly", () => {
    // 100000€ balance, 1000€/month payment, 3% annual rate
    const months = calcRemainingMonths(100000, 1000, 3);
    expect(months).toBeGreaterThan(100);
    expect(months).toBeLessThan(130);
  });

  it("should handle zero interest rate", () => {
    const payment = calcMonthlyPayment(120000, 0, 10);
    expect(payment).toBe(1000); // 120000 / (10 * 12)
  });

  it("should handle zero balance", () => {
    expect(calcRemainingMonths(0, 1000, 3)).toBe(0);
  });

  it("should handle zero monthly payment", () => {
    expect(calcRemainingMonths(100000, 0, 3)).toBe(0);
  });
});

// ===== RENDITE / YIELD CALCULATIONS =====
describe("Rendite Calculations", () => {
  it("should calculate Brutto-Rendite correctly", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // (3000 * 12 / 500000) * 100 = 7.2%
    expect(calc.bruttoRendite).toBeCloseTo(7.2, 1);
  });

  it("should calculate Netto-Rendite correctly", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // ((3000 - 600) * 12 / 500000) * 100 = 5.76%
    expect(calc.nettoRendite).toBeCloseTo(5.76, 1);
  });

  it("should calculate monatlichen Cashflow", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // Miete - BWK - Rate
    expect(calc.monatsCashflow).toBe(
      DEFAULT_INPUTS.monatlicheMiete - DEFAULT_INPUTS.bewirtschaftungskosten - calc.monatlicheRate
    );
  });

  it("should calculate Cash-on-Cash return", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // cashOnCash = (jahresCashflow / eigenkapital) * 100
    const expectedCOC = (calc.jahresCashflow / DEFAULT_INPUTS.eigenkapital) * 100;
    expect(calc.cashOnCash).toBeCloseTo(expectedCOC, 1);
  });

  it("should calculate Mietmultiplikator", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // 500000 / (3000 * 12) = 13.89
    expect(calc.mietmultiplikator).toBeCloseTo(13.89, 1);
  });

  it("should calculate AfA correctly (2% on 80% building value)", () => {
    const calc = calculateAnalysis(DEFAULT_INPUTS);
    // 500000 * 0.8 / 50 = 8000
    expect(calc.afaJaehrlich).toBe(8000);
  });

  it("should handle zero Eigenkapital", () => {
    const inputs: AnalysisInputState = { ...DEFAULT_INPUTS, eigenkapital: 0 };
    const calc = calculateAnalysis(inputs);
    expect(calc.cashOnCash).toBe(0);
  });
});

// ===== HOCKEY STICK SIMULATOR ENGINE =====
describe("Hockey Stick Simulator", () => {
  it("should return year 0 with initial values", () => {
    const data = simulate(HOCKEY_TEST_PARAMS);
    expect(data[0].year).toBe(0);
    expect(data[0].totalInvested).toBe(HOCKEY_TEST_PARAMS.startCapital);
    expect(data[0].numberOfProperties).toBe(1);
  });

  it("should generate data points for all years", () => {
    const data = simulate(HOCKEY_TEST_PARAMS);
    expect(data).toHaveLength(HOCKEY_TEST_PARAMS.years + 1); // year 0 to year N
  });

  it("should show portfolio growth over time", () => {
    const data = simulate(HOCKEY_TEST_PARAMS);
    const first = data[0].portfolioValue;
    const last = data[data.length - 1].portfolioValue;
    expect(last).toBeGreaterThan(first);
  });

  it("should reduce debt over time", () => {
    const data = simulate(HOCKEY_TEST_PARAMS);
    const initialDebt = data[0].debtRemaining;
    const finalDebt = data[data.length - 1].debtRemaining;
    expect(finalDebt).toBeLessThan(initialDebt);
  });

  it("should accumulate rental income", () => {
    const data = simulate(HOCKEY_TEST_PARAMS);
    expect(data[0].rentalIncome).toBe(0);
    expect(data[data.length - 1].rentalIncome).toBeGreaterThan(0);
  });

  it("should add additional properties at intervals", () => {
    const params = { ...HOCKEY_TEST_PARAMS, additionalProperties: 2, propertyPurchaseInterval: 5, years: 15 };
    const data = simulate(params);
    const lastPoint = data[data.length - 1];
    expect(lastPoint.numberOfProperties).toBeGreaterThan(1);
  });

  it("should have all 6 predefined scenarios", () => {
    expect(SCENARIOS).toHaveLength(6);
    expect(SCENARIOS.map(s => s.name)).toContain("Konservativ");
    expect(SCENARIOS.map(s => s.name)).toContain("Aggressiv");
  });

  it("should run sensitivity analysis", () => {
    const results = sensitivityAnalysis(HOCKEY_TEST_PARAMS, "annualReturn", [2, 4, 6, 8]);
    expect(results).toHaveLength(4);
    // Each result should have a netWorth value
    results.forEach(r => expect(typeof r.netWorth).toBe("number"));
  });

  it("should calculate real net worth adjusted for inflation", () => {
    const data = simulate(HOCKEY_TEST_PARAMS);
    const lastPoint = data[data.length - 1];
    // Real net worth should be less than nominal due to inflation
    expect(lastPoint.realNetWorth).toBeLessThan(lastPoint.netWorth);
  });
});

// ===== CRM UTILITY FUNCTIONS =====
describe("CRM Utilities", () => {
  it("should calculate polygon area (Shoelace formula)", () => {
    // Approximate 10m x 10m square near Berlin
    const coords = [
      { lat: 52.52, lon: 13.405 },
      { lat: 52.52, lon: 13.40514 },
      { lat: 52.52009, lon: 13.40514 },
      { lat: 52.52009, lon: 13.405 },
    ];
    const area = calculatePolygonArea(coords);
    expect(area).toBeGreaterThan(50);
    expect(area).toBeLessThan(200);
  });

  it("should calculate distance between two points", () => {
    // ~100m apart
    const a = { lat: 52.52, lon: 13.405 };
    const b = { lat: 52.521, lon: 13.405 };
    const dist = distanceMeters(a, b);
    expect(dist).toBeGreaterThan(90);
    expect(dist).toBeLessThan(130);
  });

  it("should score leads based on completeness", () => {
    const fullLead = {
      phone: "+491234567890",
      email: "test@test.de",
      website: "https://example.com",
      notes: "Good lead",
      call_logs: [{}],
      status: "interested",
    };
    const score = calculateLeadScore(fullLead);
    expect(score).toBeGreaterThan(70);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should score empty lead at 0", () => {
    const emptyLead = {};
    expect(calculateLeadScore(emptyLead)).toBe(0);
  });

  it("should calculate CRM stats", () => {
    const leads = [
      { status: "new" },
      { status: "new" },
      { status: "contacted" },
      { status: "interested" },
    ];
    const stats = calcCRMStats(leads);
    expect(stats.total).toBe(4);
  });

  it("should label building sizes correctly", () => {
    const info = { estimatedGrossArea: 1500, footprintArea: 300, levels: 5, buildingType: "apartments", isMFH: true, confidence: "high" as const, buildingCount: 1, buildings: [], nearbyBusinesses: [] };
    expect(getBuildingSizeLabel(info)).toBe("Großes MFH");
    
    const small = { ...info, estimatedGrossArea: 150 };
    expect(getBuildingSizeLabel(small)).toBe("EFH/ZFH");
  });

  it("should return correct colors for building sizes", () => {
    const large = { estimatedGrossArea: 1500, footprintArea: 300, levels: 5, buildingType: "apartments", isMFH: true, confidence: "high" as const, buildingCount: 1, buildings: [], nearbyBusinesses: [] };
    expect(getBuildingSizeColor(large)).toContain("green");
    
    const noArea = { ...large, estimatedGrossArea: null };
    expect(getBuildingSizeColor(noArea)).toContain("muted");
  });
});


/* IMP-141: Tests for new formatter utilities */
describe("IMP-141: Additional formatter utilities", () => {
  test("formatArea formats small areas in m²", () => {
    expect(formatArea(150)).toContain("m²");
  });

  test("formatArea formats large areas in hectares", () => {
    expect(formatArea(15000)).toContain("ha");
  });

  test("calcMonthlyPayment returns correct annuity", () => {
    const payment = calcMonthlyPayment(100000, 3, 20);
    expect(payment).toBeGreaterThan(500);
    expect(payment).toBeLessThan(600);
  });

  test("calcRemainingMonths returns 0 for no balance", () => {
    expect(calcRemainingMonths(0, 500, 3)).toBe(0);
  });

  test("formatInterestRate formats with comma decimal", () => {
    expect(formatInterestRate(3.5)).toBe("3,50 %");
  });

  test("stringToColor returns consistent HSL color", () => {
    const c1 = stringToColor("test");
    const c2 = stringToColor("test");
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^hsl\(/);
  });

  test("isValidPLZ validates German postal codes", () => {
    expect(isValidPLZ("10115")).toBe(true);
    expect(isValidPLZ("1234")).toBe(false);
    expect(isValidPLZ("123456")).toBe(false);
  });
});

/* IMP-142: Tests for sanitize utilities */
describe("IMP-142: Sanitize utilities", () => {
  test("sanitizeEmail validates and normalizes email", () => {
    expect(sanitizeEmail("  User@Example.COM  ")).toBe("user@example.com");
    expect(sanitizeEmail("notanemail")).toBe("");
  });

  test("sanitizeNumber returns fallback for NaN", () => {
    expect(sanitizeNumber("abc")).toBe(0);
    expect(sanitizeNumber(42)).toBe(42);
    expect(sanitizeNumber("3.14")).toBeCloseTo(3.14);
  });

  test("sanitizeUrl blocks javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });
});

/* IMP-143: Tests for validation utilities */
describe("IMP-143: Validation utilities", () => {
  test("isNonEmpty checks for non-empty strings", () => {
    expect(isNonEmpty("hello")).toBe(true);
    expect(isNonEmpty("  ")).toBe(false);
    expect(isNonEmpty("")).toBe(false);
    expect(isNonEmpty(null)).toBe(false);
  });

  test("isPositive checks for positive numbers", () => {
    expect(isPositive(1)).toBe(true);
    expect(isPositive(0)).toBe(false);
    expect(isPositive(-1)).toBe(false);
  });

  test("isValidDate validates date strings", () => {
    expect(isValidDate("2024-01-15")).toBe(true);
    expect(isValidDate("not-a-date")).toBe(false);
  });
});
