import { describe, it, expect } from "vitest";
import { parseNominatimResponse } from "@/lib/apiValidation";

describe("parseNominatimResponse", () => {
  it("returns empty array for non-array input", () => {
    expect(parseNominatimResponse(null)).toEqual([]);
    expect(parseNominatimResponse(undefined)).toEqual([]);
    expect(parseNominatimResponse({})).toEqual([]);
    expect(parseNominatimResponse("string")).toEqual([]);
  });

  it("parses valid Nominatim results", () => {
    const input = [
      {
        display_name: "Musterstraße 1, 10115 Berlin",
        address: { road: "Musterstraße", house_number: "1", city: "Berlin", postcode: "10115" },
        lat: "52.52",
        lon: "13.40",
        place_id: 123,
      },
    ];
    const result = parseNominatimResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].display_name).toBe("Musterstraße 1, 10115 Berlin");
    expect(result[0].address?.city).toBe("Berlin");
    expect(result[0].address?.road).toBe("Musterstraße");
    expect(result[0].lat).toBe("52.52");
    expect(result[0].lon).toBe("13.40");
  });

  it("skips invalid items and returns valid ones", () => {
    const input = [
      { display_name: "Valid", address: {} },
      null,
      { invalid: true },
      { display_name: "Also valid" },
    ];
    const result = parseNominatimResponse(input);
    expect(result).toHaveLength(2);
    expect(result[0].display_name).toBe("Valid");
    expect(result[1].display_name).toBe("Also valid");
  });

  it("handles empty address", () => {
    const input = [{ display_name: "Place" }];
    const result = parseNominatimResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].address).toEqual({});
  });
});
