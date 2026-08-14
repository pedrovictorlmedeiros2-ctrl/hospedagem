import { describe, expect, it } from "vitest";
import { calculateEloUpdate } from "../../../../src/multiplayer/domain/elo.js";

describe("calculateEloUpdate", () => {
  it("gives the challenger a positive delta and the opponent a negative one on a challenger win between equal ratings", () => {
    const result = calculateEloUpdate({ challengerRating: 1000, opponentRating: 1000, outcome: "CHALLENGER_WIN" });
    expect(result.challengerDelta).toBeGreaterThan(0);
    expect(result.opponentDelta).toBeLessThan(0);
  });

  it("is symmetric: swapping which side won swaps the sign of the deltas", () => {
    const win = calculateEloUpdate({ challengerRating: 1000, opponentRating: 1000, outcome: "CHALLENGER_WIN" });
    const loss = calculateEloUpdate({ challengerRating: 1000, opponentRating: 1000, outcome: "OPPONENT_WIN" });
    expect(win.challengerDelta).toBe(-loss.challengerDelta);
    expect(win.opponentDelta).toBe(-loss.opponentDelta);
  });

  it("leaves equal ratings unchanged on a draw", () => {
    const result = calculateEloUpdate({ challengerRating: 1200, opponentRating: 1200, outcome: "DRAW" });
    expect(result.challengerDelta).toBe(0);
    expect(result.opponentDelta).toBe(0);
  });

  it("rewards an underdog win more than a favorite win", () => {
    const underdogWins = calculateEloUpdate({ challengerRating: 900, opponentRating: 1300, outcome: "CHALLENGER_WIN" });
    const favoriteWins = calculateEloUpdate({ challengerRating: 1300, opponentRating: 900, outcome: "CHALLENGER_WIN" });
    expect(underdogWins.challengerDelta).toBeGreaterThan(favoriteWins.challengerDelta);
  });

  it("a big favorite draws against a big underdog loses rating (a draw was 'expected' to be a win)", () => {
    const result = calculateEloUpdate({ challengerRating: 1600, opponentRating: 1000, outcome: "DRAW" });
    expect(result.challengerDelta).toBeLessThan(0);
    expect(result.opponentDelta).toBeGreaterThan(0);
  });

  it("never applies the same magnitude twice for the same matchup by coincidence — deltas track the configured K-factor", () => {
    const smallK = calculateEloUpdate({ challengerRating: 1000, opponentRating: 1000, outcome: "CHALLENGER_WIN", kFactor: 10 });
    const bigK = calculateEloUpdate({ challengerRating: 1000, opponentRating: 1000, outcome: "CHALLENGER_WIN", kFactor: 40 });
    expect(bigK.challengerDelta).toBeGreaterThan(smallK.challengerDelta);
  });
});
