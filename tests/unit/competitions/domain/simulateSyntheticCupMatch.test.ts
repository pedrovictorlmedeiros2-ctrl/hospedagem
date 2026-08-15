import { describe, expect, it } from "vitest";
import { simulateSyntheticCupMatch } from "../../../../src/competitions/domain/simulateSyntheticCupMatch.js";

describe("simulateSyntheticCupMatch", () => {
  it("is deterministic for the same matchId", () => {
    const a = simulateSyntheticCupMatch("match-1");
    const b = simulateSyntheticCupMatch("match-1");
    expect(a).toEqual(b);
  });

  it("produces a plausible scoreline", () => {
    const result = simulateSyntheticCupMatch("match-2");
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.homeScore).toBeLessThanOrEqual(3);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeLessThanOrEqual(3);
  });

  it("varies by matchId", () => {
    const results = new Set(
      Array.from({ length: 10 }, (_, i) => JSON.stringify(simulateSyntheticCupMatch(`match-${i}`))),
    );
    expect(results.size).toBeGreaterThan(1);
  });
});
