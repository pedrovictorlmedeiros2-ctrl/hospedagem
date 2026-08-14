import { describe, expect, it } from "vitest";
import { createRng } from "../../../../src/game/domain/rng.js";
import { generateDistinctClubName, RIVAL_CLUB_KEYS } from "../../../../src/career/domain/clubNaming.js";

describe("generateDistinctClubName", () => {
  it("never produces a duplicate name across the fixed rival club pool", () => {
    // Regression test: independent random draws for type+place collided
    // in practice (two rival clubs both generated "Clube Recreativo
    // Porto Novo"), which is confusing side by side in a league table.
    const names = RIVAL_CLUB_KEYS.map((key, ordinal) => generateDistinctClubName(createRng(key), ordinal));
    expect(new Set(names).size).toBe(names.length);
  });

  it("is deterministic for a given seed and ordinal", () => {
    const a = generateDistinctClubName(createRng("rival-club-1"), 0);
    const b = generateDistinctClubName(createRng("rival-club-1"), 0);
    expect(a).toBe(b);
  });
});
