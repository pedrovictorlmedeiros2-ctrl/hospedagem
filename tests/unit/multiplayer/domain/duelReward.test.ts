import { describe, expect, it } from "vitest";
import { calculateDuelReward } from "../../../../src/multiplayer/domain/duelReward.js";

describe("calculateDuelReward", () => {
  it("pays more for a win than a draw than a loss, but never zero", () => {
    const win = calculateDuelReward("WIN");
    const draw = calculateDuelReward("DRAW");
    const loss = calculateDuelReward("LOSS");

    expect(win).toBeGreaterThan(draw);
    expect(draw).toBeGreaterThan(loss);
    expect(loss).toBeGreaterThan(0);
  });
});
