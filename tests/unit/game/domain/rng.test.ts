import { describe, expect, it } from "vitest";
import {
  createRng,
  randomInt,
  rollContest,
  weightedPick,
} from "../../../../src/game/domain/rng.js";

describe("createRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRng("same-seed");
    const b = createRng("same-seed");

    const sequenceA = Array.from({ length: 20 }, () => a());
    const sequenceB = Array.from({ length: 20 }, () => b());

    expect(sequenceA).toEqual(sequenceB);
  });

  it("produces a different sequence for a different seed", () => {
    const a = createRng("seed-one");
    const b = createRng("seed-two");

    const sequenceA = Array.from({ length: 20 }, () => a());
    const sequenceB = Array.from({ length: 20 }, () => b());

    expect(sequenceA).not.toEqual(sequenceB);
  });

  it("only produces values in [0, 1)", () => {
    const rng = createRng("range-check");
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("is reasonably well distributed across the range (not stuck near one value)", () => {
    const rng = createRng("distribution-check");
    const values = Array.from({ length: 2000 }, () => rng());
    const average = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(average).toBeGreaterThan(0.4);
    expect(average).toBeLessThan(0.6);
  });
});

describe("randomInt", () => {
  it("stays within [min, max] inclusive", () => {
    const rng = createRng("int-check");
    for (let i = 0; i < 500; i++) {
      const value = randomInt(rng, 3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
    }
  });
});

describe("weightedPick", () => {
  it("picks the only option when there is one entry", () => {
    const rng = createRng("single-entry");
    expect(weightedPick(rng, [["only", 1]])).toBe("only");
  });

  it("favors the heavier-weighted option over many draws", () => {
    const rng = createRng("weighted-check");
    const counts = { heavy: 0, light: 0 };
    for (let i = 0; i < 1000; i++) {
      const pick = weightedPick<"heavy" | "light">(rng, [
        ["heavy", 90],
        ["light", 10],
      ]);
      counts[pick] += 1;
    }
    expect(counts.heavy).toBeGreaterThan(counts.light * 3);
  });

  it("throws on an empty entry list", () => {
    const rng = createRng("empty-check");
    expect(() => weightedPick(rng, [])).toThrow();
  });
});

describe("rollContest", () => {
  it("favors the stronger rating over many trials", () => {
    const rng = createRng("contest-check");
    let strongWins = 0;
    for (let i = 0; i < 500; i++) {
      if (rollContest(rng, 90, 20)) strongWins += 1;
    }
    expect(strongWins).toBeGreaterThan(400);
  });

  it("is roughly even when ratings are equal", () => {
    const rng = createRng("even-contest");
    let aWins = 0;
    for (let i = 0; i < 1000; i++) {
      if (rollContest(rng, 50, 50)) aWins += 1;
    }
    expect(aWins).toBeGreaterThan(400);
    expect(aWins).toBeLessThan(600);
  });
});
