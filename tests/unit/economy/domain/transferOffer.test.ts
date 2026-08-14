import { describe, expect, it } from "vitest";
import { createRng } from "../../../../src/game/domain/rng.js";
import {
  calculateSigningBonus,
  canTransferNow,
  generateTransferOffer,
  MIN_DAYS_BETWEEN_TRANSFERS,
} from "../../../../src/economy/domain/transferOffer.js";

describe("generateTransferOffer", () => {
  it("is unavailable when the player's overall is well below what the club requires", () => {
    const offer = generateTransferOffer({
      rng: createRng("seed-1"),
      playerMarketValue: 10000,
      playerOverall: 20,
      toClubReputation: 90,
    });
    expect(offer.available).toBe(false);
    expect(offer.fee).toBe(0);
  });

  it("is available when the player's overall clears the reputation bar, with a positive fee", () => {
    const offer = generateTransferOffer({
      rng: createRng("seed-1"),
      playerMarketValue: 10000,
      playerOverall: 90,
      toClubReputation: 45,
    });
    expect(offer.available).toBe(true);
    expect(offer.fee).toBeGreaterThan(0);
  });

  it("is deterministic for the same seed", () => {
    const input = { playerMarketValue: 10000, playerOverall: 80, toClubReputation: 45 };
    const a = generateTransferOffer({ ...input, rng: createRng("same-seed") });
    const b = generateTransferOffer({ ...input, rng: createRng("same-seed") });
    expect(a).toEqual(b);
  });

  it("fee always lands within the documented [0.9x, 1.5x] band of market value", () => {
    for (let i = 0; i < 50; i++) {
      const offer = generateTransferOffer({
        rng: createRng(`seed-${i}`),
        playerMarketValue: 10000,
        playerOverall: 80,
        toClubReputation: 45,
      });
      expect(offer.fee).toBeGreaterThanOrEqual(9000);
      expect(offer.fee).toBeLessThanOrEqual(15000);
    }
  });
});

describe("calculateSigningBonus", () => {
  it("is strictly less than the full fee — the player never pockets the whole transfer fee", () => {
    expect(calculateSigningBonus(10000)).toBeLessThan(10000);
    expect(calculateSigningBonus(10000)).toBeGreaterThan(0);
  });
});

describe("canTransferNow", () => {
  it("allows a first-ever transfer", () => {
    expect(canTransferNow(null, new Date())).toBe(true);
  });

  it("blocks a second transfer before the cooldown elapses", () => {
    const lastTransferAt = new Date("2026-08-14T00:00:00Z");
    const soonAfter = new Date(lastTransferAt.getTime() + 24 * 60 * 60 * 1000);
    expect(canTransferNow(lastTransferAt, soonAfter)).toBe(false);
  });

  it("allows a second transfer once the cooldown has elapsed", () => {
    const lastTransferAt = new Date("2026-08-14T00:00:00Z");
    const later = new Date(lastTransferAt.getTime() + (MIN_DAYS_BETWEEN_TRANSFERS + 1) * 24 * 60 * 60 * 1000);
    expect(canTransferNow(lastTransferAt, later)).toBe(true);
  });
});
