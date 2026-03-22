import { describe, it, expect } from "vitest";
import { filterAndSortDeals, isFormValid, getDealAgeColor } from "./dealUtils";
import type { DealRecord } from "./DealTypes";
import { emptyForm } from "./DealTypes";

function makeDeal(partial: Partial<DealRecord> & Pick<DealRecord, "id" | "title">): DealRecord {
  return {
    address: "",
    description: "",
    stage: "recherche",
    purchase_price: 0,
    expected_rent: 0,
    sqm: 0,
    units: 1,
    property_type: "ETW",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    source: "",
    notes: "",
    lost_reason: "",
    created_at: "2025-01-01T00:00:00Z",
    ...partial,
  };
}

describe("filterAndSortDeals", () => {
  const deals: DealRecord[] = [
    makeDeal({ id: "1", title: "Alpha Berlin", address: "Hauptstr 1", purchase_price: 100, stage: "recherche" }),
    makeDeal({ id: "2", title: "Beta München", contact_name: "Max", purchase_price: 200, stage: "angebot" }),
  ];

  it("filters by title", () => {
    const r = filterAndSortDeals(deals, "berlin", "title", true);
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe("Alpha Berlin");
  });

  it("filters by contact_name", () => {
    const r = filterAndSortDeals(deals, "max", "title", true);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("2");
  });

  it("sorts by purchase_price ascending", () => {
    const r = filterAndSortDeals(deals, "", "purchase_price", true);
    expect(r.map((d) => d.id)).toEqual(["1", "2"]);
  });

  it("sorts by purchase_price descending", () => {
    const r = filterAndSortDeals(deals, "", "purchase_price", false);
    expect(r.map((d) => d.id)).toEqual(["2", "1"]);
  });

  it("handles non-array input", () => {
    expect(filterAndSortDeals(null as unknown as DealRecord[], "", "title", true)).toEqual([]);
  });
});

describe("isFormValid", () => {
  it("requires non-empty title", () => {
    expect(isFormValid({ ...emptyForm, title: "  " })).toBe(false);
    expect(isFormValid({ ...emptyForm, title: "OK" })).toBe(true);
  });
});

describe("getDealAgeColor", () => {
  it("returns green for fresh deals", () => {
    expect(getDealAgeColor(3)).toContain("green");
  });
});
