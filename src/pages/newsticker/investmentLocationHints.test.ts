import { describe, expect, it } from "vitest";
import {
  buildPortfolioLocationHints,
  portfolioLocationMatchScore,
} from "./investmentLocationHints";
import type { Property } from "@/data/mockData";

function prop(p: Partial<Property> & Pick<Property, "id" | "name">): Property {
  return {
    location: "",
    address: "",
    type: "ETW",
    units: 1,
    purchasePrice: 0,
    purchaseDate: "",
    currentValue: 0,
    monthlyRent: 0,
    monthlyExpenses: 0,
    monthlyCreditRate: 0,
    monthlyCashflow: 0,
    remainingDebt: 0,
    interestRate: 0,
    sqm: 0,
    yearBuilt: 2000,
    ownership: "privat",
    ...p,
  };
}

describe("investmentLocationHints", () => {
  it("liest Städte aus Objekt-Standort und Adresse", () => {
    const hints = buildPortfolioLocationHints(
      [
        prop({
          id: "1",
          name: "MFH",
          location: "Rostock",
          address: "12345 Rostock",
        }),
      ],
      [],
    );
    expect(hints.hasPortfolioData).toBe(true);
    expect(hints.summaryLabel.toLowerCase()).toContain("rostock");
    expect(hints.matchTerms.some((t) => t.includes("rostock"))).toBe(true);
  });

  it("ignoriert abgelehnte Deals", () => {
    const hints = buildPortfolioLocationHints([], [
      { title: "Leipzig Zentrum", address: "Leipzig", stage: "abgelehnt" },
    ]);
    expect(hints.hasPortfolioData).toBe(false);
  });

  it("portfolioLocationMatchScore erhöht Treffer bei Ortsnamen im Text", () => {
    const hints = buildPortfolioLocationHints(
      [prop({ id: "1", name: "x", location: "Dresden", address: "" })],
      [],
    );
    const text = "immobilienmarkt in dresden: preise steigen".toLowerCase();
    expect(portfolioLocationMatchScore(text, hints)).toBeGreaterThan(0);
  });
});
