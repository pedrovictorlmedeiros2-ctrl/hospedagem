import { describe, expect, it } from "vitest";
import {
  createPatternMemory,
  patternReadBonus,
  recordAction,
} from "../../../../src/game/ai/pattern.js";

describe("pattern memory", () => {
  it("gives no bonus before the action has repeated enough", () => {
    const memory = createPatternMemory();
    recordAction(memory, "DRIBBLE");
    recordAction(memory, "DRIBBLE");

    expect(patternReadBonus(memory, "DRIBBLE")).toBe(0);
  });

  it("rewards the defense once the same action repeats past the threshold — 'sempre corta para a direita' becomes readable", () => {
    const memory = createPatternMemory();
    recordAction(memory, "DRIBBLE");
    recordAction(memory, "DRIBBLE");
    recordAction(memory, "DRIBBLE");

    expect(patternReadBonus(memory, "DRIBBLE")).toBeGreaterThan(0);
  });

  it("does not reward the defense against a different action that hasn't repeated", () => {
    const memory = createPatternMemory();
    recordAction(memory, "DRIBBLE");
    recordAction(memory, "DRIBBLE");
    recordAction(memory, "DRIBBLE");

    expect(patternReadBonus(memory, "PASS")).toBe(0);
  });

  it("only looks at a sliding window, so an old pattern is forgotten once enough different actions follow", () => {
    const memory = createPatternMemory();
    recordAction(memory, "DRIBBLE");
    recordAction(memory, "DRIBBLE");
    recordAction(memory, "DRIBBLE");
    recordAction(memory, "PASS");
    recordAction(memory, "PASS");
    recordAction(memory, "PASS");
    recordAction(memory, "PASS");

    expect(patternReadBonus(memory, "DRIBBLE")).toBe(0);
  });
});
