import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatCurrencyCompact,
  formatNumberDE,
  parseNumberDE,
  formatDurationMonths,
  clamp,
  safeDivide,
  formatCompactDE,
  pluralDE,
  isEqual,
  generateTempId,
  truncate,
  sortByKey,
  formatPhoneDE,
  isValidIBAN,
  calculateROI,
  formatDaysUntil,
  normalizeString,
  isValidPLZ,
  calcMonthlyPayment,
  calcRemainingMonths,
  isWithinTolerance,
  formatInterestRate,
  stringToColor,
  formatSignedCompact,
} from "@/lib/formatters";

/* TEST-1: Formatter utilities — core formatting functions */

describe("formatCurrency", () => {
  it("formats positive numbers as EUR", () => {
    expect(formatCurrency(1000)).toMatch(/1\.000/);
    expect(formatCurrency(1000)).toMatch(/€/);
  });
  it("formats zero", () => {
    expect(formatCurrency(0)).toMatch(/0/);
  });
  it("formats negative numbers", () => {
    expect(formatCurrency(-5000)).toMatch(/5\.000/);
  });
});

describe("formatPercent", () => {
  it("formats with default 1 decimal", () => {
    expect(formatPercent(12.345)).toBe("12.3%");
  });
  it("formats with custom decimals", () => {
    expect(formatPercent(12.345, 2)).toBe("12.35%");
  });
  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("formatDate", () => {
  it("formats ISO date to German locale", () => {
    const result = formatDate("2024-01-15");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/1/);
    expect(result).toMatch(/2024/);
  });
});

describe("formatCurrencyCompact", () => {
  it("formats millions", () => {
    expect(formatCurrencyCompact(1500000)).toMatch(/1\.5 Mio/);
  });
  it("formats thousands", () => {
    expect(formatCurrencyCompact(50000)).toMatch(/50 T€/);
  });
  it("formats small numbers normally", () => {
    expect(formatCurrencyCompact(500)).toMatch(/500/);
  });
});

describe("formatNumberDE", () => {
  it("formats numbers with German separators", () => {
    expect(formatNumberDE(1234567)).toMatch(/1\.234\.567/);
  });
  it("handles string input", () => {
    expect(formatNumberDE("1234")).toMatch(/1\.234/);
  });
  it("returns empty for NaN", () => {
    expect(formatNumberDE("abc")).toBe("");
  });
});

describe("parseNumberDE", () => {
  it("parses German-formatted numbers", () => {
    expect(parseNumberDE("1.234,56")).toBe(1234.56);
  });
  it("returns 0 for empty string", () => {
    expect(parseNumberDE("")).toBe(0);
  });
  it("returns 0 for invalid input", () => {
    expect(parseNumberDE("abc")).toBe(0);
  });
});

describe("formatDurationMonths", () => {
  it("formats months < 12", () => {
    expect(formatDurationMonths(6)).toBe("6 Monate");
    expect(formatDurationMonths(1)).toBe("1 Monat");
  });
  it("formats years", () => {
    expect(formatDurationMonths(24)).toBe("2 Jahre");
    expect(formatDurationMonths(12)).toBe("1 Jahr");
  });
  it("formats years + months", () => {
    expect(formatDurationMonths(15)).toBe("1J 3M");
  });
  it("returns abgelaufen for 0", () => {
    expect(formatDurationMonths(0)).toBe("abgelaufen");
  });
});

describe("clamp", () => {
  it("clamps within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps below min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps above max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("safeDivide", () => {
  it("divides normally", () => {
    expect(safeDivide(10, 2)).toBe(5);
  });
  it("returns fallback for zero denominator", () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 0, -1)).toBe(-1);
  });
});

describe("formatCompactDE", () => {
  it("formats millions", () => {
    expect(formatCompactDE(2500000)).toBe("2.5M");
  });
  it("formats thousands", () => {
    expect(formatCompactDE(50000)).toBe("50K");
  });
  it("formats negative numbers", () => {
    expect(formatCompactDE(-1000000)).toBe("-1.0M");
  });
});

describe("pluralDE", () => {
  it("returns singular for 1", () => {
    expect(pluralDE(1, "Objekt", "Objekte")).toBe("1 Objekt");
  });
  it("returns plural for > 1", () => {
    expect(pluralDE(5, "Objekt", "Objekte")).toBe("5 Objekte");
  });
});

describe("isEqual", () => {
  it("compares primitives", () => {
    expect(isEqual(1, 1)).toBe(true);
    expect(isEqual(1, 2)).toBe(false);
    expect(isEqual("a", "a")).toBe(true);
  });
  it("compares objects", () => {
    expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(isEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
  it("compares nested objects", () => {
    expect(isEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(isEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });
});

describe("generateTempId", () => {
  it("generates unique IDs", () => {
    const id1 = generateTempId();
    const id2 = generateTempId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^temp_/);
  });
});

describe("truncate", () => {
  it("truncates long strings", () => {
    expect(truncate("Hello World", 5)).toBe("Hell…");
  });
  it("does not truncate short strings", () => {
    expect(truncate("Hi", 5)).toBe("Hi");
  });
});

describe("sortByKey", () => {
  it("sorts ascending by number", () => {
    const arr = [{ n: 3 }, { n: 1 }, { n: 2 }];
    expect(sortByKey(arr, "n").map(x => x.n)).toEqual([1, 2, 3]);
  });
  it("sorts descending", () => {
    const arr = [{ n: 3 }, { n: 1 }, { n: 2 }];
    expect(sortByKey(arr, "n", true).map(x => x.n)).toEqual([3, 2, 1]);
  });
});

describe("formatPhoneDE", () => {
  it("formats +49 numbers", () => {
    expect(formatPhoneDE("+493012345678")).toBe("+49 30 12345678");
  });
  it("formats 0 prefix numbers", () => {
    expect(formatPhoneDE("03012345678")).toMatch(/030/);
  });
});

describe("isValidIBAN", () => {
  it("validates correct IBAN", () => {
    expect(isValidIBAN("DE89370400440532013000")).toBe(true);
  });
  it("rejects invalid IBAN", () => {
    expect(isValidIBAN("DE123")).toBe(false);
    expect(isValidIBAN("FR89370400440532013000")).toBe(false);
  });
});

describe("calculateROI", () => {
  it("calculates ROI correctly", () => {
    expect(calculateROI(1000, 100000)).toBeCloseTo(12, 0);
  });
  it("returns 0 for zero investment", () => {
    expect(calculateROI(1000, 0)).toBe(0);
  });
});

describe("normalizeString", () => {
  it("lowercases and removes accents", () => {
    expect(normalizeString("München")).toBe("munchen");
    expect(normalizeString("  Hello  ")).toBe("hello");
  });
});

describe("isValidPLZ", () => {
  it("validates 5-digit codes", () => {
    expect(isValidPLZ("10115")).toBe(true);
    expect(isValidPLZ("1234")).toBe(false);
    expect(isValidPLZ("123456")).toBe(false);
  });
});

describe("calcMonthlyPayment", () => {
  it("calculates monthly mortgage", () => {
    const payment = calcMonthlyPayment(200000, 3, 25);
    expect(payment).toBeGreaterThan(900);
    expect(payment).toBeLessThan(1000);
  });
  it("handles zero rate", () => {
    expect(calcMonthlyPayment(12000, 0, 10)).toBeCloseTo(100, 0);
  });
});

describe("calcRemainingMonths", () => {
  it("calculates remaining loan term", () => {
    const months = calcRemainingMonths(100000, 1000, 3);
    expect(months).toBeGreaterThan(100);
    expect(months).toBeLessThan(200);
  });
  it("returns 0 for zero balance", () => {
    expect(calcRemainingMonths(0, 1000, 3)).toBe(0);
  });
});

describe("isWithinTolerance", () => {
  it("detects within tolerance", () => {
    expect(isWithinTolerance(100, 100, 5)).toBe(true);
    expect(isWithinTolerance(104, 100, 5)).toBe(true);
  });
  it("detects outside tolerance", () => {
    expect(isWithinTolerance(110, 100, 5)).toBe(false);
  });
});

describe("formatInterestRate", () => {
  it("formats with German decimal", () => {
    expect(formatInterestRate(2.5)).toBe("2,50 %");
  });
});

describe("stringToColor", () => {
  it("generates consistent HSL color", () => {
    const c1 = stringToColor("test");
    const c2 = stringToColor("test");
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^hsl\(/);
  });
  it("generates different colors for different strings", () => {
    expect(stringToColor("a")).not.toBe(stringToColor("b"));
  });
});

describe("formatSignedCompact", () => {
  it("adds + for positive", () => {
    expect(formatSignedCompact(5000)).toBe("+5K");
  });
  it("adds - for negative", () => {
    expect(formatSignedCompact(-1000000)).toBe("-1.0M");
  });
});

describe("formatDaysUntil", () => {
  it("returns 'Heute' for today", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(formatDaysUntil(today)).toBe("Heute");
  });
  it("returns überfällig for past dates", () => {
    expect(formatDaysUntil("2020-01-01")).toMatch(/überfällig/);
  });
});
