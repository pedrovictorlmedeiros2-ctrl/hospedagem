import { describe, expect, it } from "vitest";
import {
  calculateReleaseClause,
  calculateSalaryPerMatch,
  contractEndDate,
  isContractExpired,
} from "../../../../src/economy/domain/contract.js";

describe("calculateSalaryPerMatch", () => {
  it("scales with the base value", () => {
    expect(calculateSalaryPerMatch(10000)).toBeGreaterThan(calculateSalaryPerMatch(1000));
  });

  it("never falls below the floor, even for a near-worthless player", () => {
    expect(calculateSalaryPerMatch(1)).toBeGreaterThanOrEqual(5);
  });
});

describe("calculateReleaseClause", () => {
  it("is strictly greater than the market value it's derived from", () => {
    expect(calculateReleaseClause(10000)).toBeGreaterThan(10000);
  });
});

describe("contract expiry", () => {
  it("is not expired the day it starts", () => {
    const startsAt = new Date("2026-08-14T00:00:00Z");
    const endsAt = contractEndDate(startsAt);
    expect(isContractExpired({ endsAt }, startsAt)).toBe(false);
  });

  it("is expired once `now` reaches endsAt", () => {
    const startsAt = new Date("2026-08-14T00:00:00Z");
    const endsAt = contractEndDate(startsAt);
    expect(isContractExpired({ endsAt }, endsAt)).toBe(true);
    expect(isContractExpired({ endsAt }, new Date(endsAt.getTime() + 1))).toBe(true);
  });
});
