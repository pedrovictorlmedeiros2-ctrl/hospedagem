import { describe, expect, it } from "vitest";
import { calculateMatchReward } from "../../../../src/economy/domain/matchReward.js";

describe("calculateMatchReward", () => {
  it("pays a flat, small participation reward for the bench, regardless of the match result", () => {
    const win = calculateMatchReward({ outcome: "WIN", lineupStatus: "BENCH", goals: 3, assists: 2, rating: 9 });
    const loss = calculateMatchReward({ outcome: "LOSS", lineupStatus: "BENCH", goals: 0, assists: 0, rating: 5 });

    expect(win).toBe(loss);
    expect(win).toBeGreaterThan(0);
  });

  it("pays more for a win than a draw than a loss when starting", () => {
    const base = { lineupStatus: "STARTING" as const, goals: 0, assists: 0, rating: 6 };
    const win = calculateMatchReward({ ...base, outcome: "WIN" });
    const draw = calculateMatchReward({ ...base, outcome: "DRAW" });
    const loss = calculateMatchReward({ ...base, outcome: "LOSS" });

    expect(win).toBeGreaterThan(draw);
    expect(draw).toBeGreaterThan(loss);
  });

  it("rewards goals and assists on top of the outcome bonus", () => {
    const base = { outcome: "DRAW" as const, lineupStatus: "STARTING" as const, rating: 6 };
    const noContribution = calculateMatchReward({ ...base, goals: 0, assists: 0 });
    const withGoal = calculateMatchReward({ ...base, goals: 1, assists: 0 });
    const withAssist = calculateMatchReward({ ...base, goals: 0, assists: 1 });

    expect(withGoal).toBeGreaterThan(noContribution);
    expect(withAssist).toBeGreaterThan(noContribution);
  });

  it("adds a man-of-the-match bonus at a high rating", () => {
    const base = { outcome: "DRAW" as const, lineupStatus: "STARTING" as const, goals: 0, assists: 0 };
    const average = calculateMatchReward({ ...base, rating: 6.5 });
    const excellent = calculateMatchReward({ ...base, rating: 8.5 });

    expect(excellent).toBeGreaterThan(average);
  });

  it("starting always pays strictly more than bench, even in a loss with no contribution", () => {
    const bench = calculateMatchReward({ outcome: "LOSS", lineupStatus: "BENCH", goals: 0, assists: 0, rating: 5 });
    const starting = calculateMatchReward({ outcome: "LOSS", lineupStatus: "STARTING", goals: 0, assists: 0, rating: 5 });

    expect(starting).toBeGreaterThan(bench);
  });
});
