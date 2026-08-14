import { describe, expect, it } from "vitest";
import { ageFromBirthDate, calculateMarketValue } from "../../../../src/economy/domain/marketValue.js";

describe("calculateMarketValue", () => {
  it("increases with overall, holding age fixed", () => {
    const low = calculateMarketValue({ overall: 50, age: 25 });
    const high = calculateMarketValue({ overall: 80, age: 25 });
    expect(high).toBeGreaterThan(low);
  });

  it("peaks for young players and declines with age, holding overall fixed", () => {
    const young = calculateMarketValue({ overall: 70, age: 20 });
    const prime = calculateMarketValue({ overall: 70, age: 26 });
    const veteran = calculateMarketValue({ overall: 70, age: 35 });

    expect(young).toBeGreaterThan(prime);
    expect(prime).toBeGreaterThan(veteran);
  });

  it("is always positive for a valid player", () => {
    expect(calculateMarketValue({ overall: 40, age: 40 })).toBeGreaterThan(0);
  });
});

describe("ageFromBirthDate", () => {
  it("round-trips with the UTC-year-subtraction model used at profile creation", () => {
    const now = new Date("2026-08-14T00:00:00Z");
    const birthDate = new Date(now);
    birthDate.setUTCFullYear(birthDate.getUTCFullYear() - 23);

    expect(ageFromBirthDate(birthDate, now)).toBe(23);
  });
});
