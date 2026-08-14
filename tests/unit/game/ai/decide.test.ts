import { describe, expect, it } from "vitest";
import {
  decideAttackAction,
  decideDefenseReaction,
  type DecisionContext,
} from "../../../../src/game/ai/decide.js";
import { createRng } from "../../../../src/game/domain/rng.js";
import type { AttackAction, DefenseReaction } from "../../../../src/game/domain/types.js";

function baseContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    minute: 30,
    attackerProgress: 0.3,
    scoreDiff: 0,
    attackerStamina: 90,
    defenderStamina: 90,
    timeRemaining: 60,
    ...overrides,
  };
}

function countAttackActions(
  context: DecisionContext,
  style: Parameters<typeof decideAttackAction>[1],
  seed: string,
  trials = 400,
) {
  const rng = createRng(seed);
  const counts: Record<AttackAction, number> = { HOLD: 0, PASS: 0, DRIBBLE: 0, SHOOT: 0, CROSS: 0 };
  for (let i = 0; i < trials; i++) {
    counts[decideAttackAction(context, style, rng).action] += 1;
  }
  return counts;
}

function countDefenseReactions(
  context: DecisionContext,
  style: Parameters<typeof decideDefenseReaction>[1],
  seed: string,
  trials = 400,
) {
  const rng = createRng(seed);
  const counts: Record<DefenseReaction, number> = { DEFEND: 0, PRESS: 0, RECOVER: 0 };
  for (let i = 0; i < trials; i++) {
    counts[decideDefenseReaction(context, style, rng).reaction] += 1;
  }
  return counts;
}

describe("decideAttackAction", () => {
  it("shoots far more often deep in the opponent's box than in its own half", () => {
    const deep = countAttackActions(
      baseContext({ attackerProgress: 0.95 }),
      "TACTICAL",
      "deep-seed",
    );
    const shallow = countAttackActions(
      baseContext({ attackerProgress: 0.1 }),
      "TACTICAL",
      "shallow-seed",
    );

    expect(deep.SHOOT).toBeGreaterThan(shallow.SHOOT * 3);
  });

  it("DRIBBLING style dribbles more than DEFENSIVE style in the same context", () => {
    const context = baseContext({ attackerProgress: 0.5 });
    const dribbling = countAttackActions(context, "DRIBBLING", "style-seed-a");
    const defensive = countAttackActions(context, "DEFENSIVE", "style-seed-b");

    expect(dribbling.DRIBBLE).toBeGreaterThan(defensive.DRIBBLE);
  });

  it("holds the ball more when tired than when fresh", () => {
    const fresh = countAttackActions(
      baseContext({ attackerStamina: 95 }),
      "TACTICAL",
      "stamina-seed-a",
    );
    const tired = countAttackActions(
      baseContext({ attackerStamina: 20 }),
      "TACTICAL",
      "stamina-seed-b",
    );

    // Tired teams pass more and dribble less — dribble share should drop.
    expect(tired.DRIBBLE).toBeLessThan(fresh.DRIBBLE);
  });

  it("gets more desperate (shoots/dribbles more, holds less) when losing late", () => {
    const calm = countAttackActions(
      baseContext({ scoreDiff: 0, timeRemaining: 60 }),
      "TACTICAL",
      "calm-seed",
    );
    const desperate = countAttackActions(
      baseContext({ scoreDiff: -1, timeRemaining: 5 }),
      "TACTICAL",
      "desperate-seed",
    );

    expect(desperate.HOLD).toBeLessThan(calm.HOLD);
  });
});

describe("decideDefenseReaction", () => {
  it("AGGRESSIVE style presses more than DEFENSIVE style in the same context", () => {
    const context = baseContext();
    const aggressive = countDefenseReactions(context, "AGGRESSIVE", "def-seed-a");
    const defensive = countDefenseReactions(context, "DEFENSIVE", "def-seed-b");

    expect(aggressive.PRESS).toBeGreaterThan(defensive.PRESS);
  });

  it("recovers more than it presses when exhausted", () => {
    const fresh = countDefenseReactions(
      baseContext({ defenderStamina: 95 }),
      "AGGRESSIVE",
      "rec-seed-a",
    );
    const exhausted = countDefenseReactions(
      baseContext({ defenderStamina: 15 }),
      "AGGRESSIVE",
      "rec-seed-b",
    );

    expect(exhausted.RECOVER).toBeGreaterThan(fresh.RECOVER);
    expect(exhausted.PRESS).toBeLessThan(fresh.PRESS);
  });
});
