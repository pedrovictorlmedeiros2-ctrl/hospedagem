import { describe, expect, it } from "vitest";
import {
  attributeFieldFor,
  calculateTrainingGain,
  canTrainNow,
  focusesForPosition,
  MIN_STAMINA_TO_TRAIN,
  TRAINING_COOLDOWN_HOURS,
  validateFocusForPosition,
} from "../../../../src/career/domain/training.js";
import { ValidationError } from "../../../../src/shared/errors.js";

describe("focusesForPosition / validateFocusForPosition", () => {
  it("gives outfield players outfield-only focuses", () => {
    expect(focusesForPosition("ST")).toContain("SHOOTING");
    expect(focusesForPosition("ST")).not.toContain("GK_REFLEXES");
  });

  it("gives goalkeepers goalkeeper-only focuses", () => {
    expect(focusesForPosition("GK")).toContain("GK_REFLEXES");
    expect(focusesForPosition("GK")).not.toContain("SHOOTING");
  });

  it("rejects a goalkeeper focus for an outfield player", () => {
    expect(() => validateFocusForPosition("GK_REFLEXES", "ST")).toThrow(ValidationError);
  });

  it("rejects an outfield focus for a goalkeeper", () => {
    expect(() => validateFocusForPosition("SHOOTING", "GK")).toThrow(ValidationError);
  });

  it("accepts a matching focus", () => {
    expect(() => validateFocusForPosition("SHOOTING", "ST")).not.toThrow();
    expect(() => validateFocusForPosition("GK_REFLEXES", "GK")).not.toThrow();
  });
});

describe("attributeFieldFor", () => {
  it("maps every focus to a distinct Player attribute field", () => {
    const fields = new Set([
      attributeFieldFor("PACE"),
      attributeFieldFor("SHOOTING"),
      attributeFieldFor("PASSING"),
      attributeFieldFor("DRIBBLING"),
      attributeFieldFor("DEFENDING"),
      attributeFieldFor("PHYSICAL"),
      attributeFieldFor("GK_REFLEXES"),
      attributeFieldFor("GK_POSITIONING"),
      attributeFieldFor("GK_HANDLING"),
      attributeFieldFor("GK_AERIAL"),
      attributeFieldFor("GK_ONE_ON_ONE"),
      attributeFieldFor("GK_PENALTIES"),
    ]);
    expect(fields.size).toBe(12);
  });
});

describe("calculateTrainingGain", () => {
  it("gives a bigger gain to a low attribute than a high one", () => {
    expect(calculateTrainingGain(30)).toBeGreaterThan(calculateTrainingGain(90));
  });

  it("never gains at or above the 99 cap", () => {
    expect(calculateTrainingGain(99)).toBe(0);
    expect(calculateTrainingGain(99.5)).toBe(0);
  });

  it("always gains at least 1 point below the cap", () => {
    for (let value = 1; value < 99; value += 7) {
      expect(calculateTrainingGain(value)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("canTrainNow", () => {
  it("allows training when there is no previous session", () => {
    expect(canTrainNow(null, new Date())).toBe(true);
  });

  it("blocks training before the cooldown elapses", () => {
    const last = new Date("2026-08-14T00:00:00Z");
    const soonAfter = new Date(last.getTime() + (TRAINING_COOLDOWN_HOURS - 1) * 60 * 60 * 1000);
    expect(canTrainNow(last, soonAfter)).toBe(false);
  });

  it("allows training once the cooldown has elapsed", () => {
    const last = new Date("2026-08-14T00:00:00Z");
    const later = new Date(last.getTime() + (TRAINING_COOLDOWN_HOURS + 1) * 60 * 60 * 1000);
    expect(canTrainNow(last, later)).toBe(true);
  });

  it("has a minimum stamina requirement lower than a full-fatigue floor (sanity bound)", () => {
    expect(MIN_STAMINA_TO_TRAIN).toBeGreaterThan(0);
    expect(MIN_STAMINA_TO_TRAIN).toBeLessThan(100);
  });
});
