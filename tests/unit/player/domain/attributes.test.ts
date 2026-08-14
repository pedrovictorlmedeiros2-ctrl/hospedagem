import { describe, expect, it } from "vitest";
import {
  calculateInitialAttributes,
  calculateOverall,
} from "../../../../src/player/domain/attributes.js";

describe("calculateInitialAttributes", () => {
  it("gives an outfield player a flat 50 baseline and null goalkeeper attributes", () => {
    const attrs = calculateInitialAttributes("ST");

    expect(attrs.pace).toBe(50);
    expect(attrs.shooting).toBe(50);
    expect(attrs.gkReflexes).toBeNull();
  });

  it("gives a goalkeeper a flat 50 baseline on goalkeeper attributes", () => {
    const attrs = calculateInitialAttributes("GK");

    expect(attrs.gkReflexes).toBe(50);
    expect(attrs.gkPenalties).toBe(50);
  });
});

describe("calculateOverall", () => {
  it("returns the flat baseline overall for a fresh outfield player regardless of position weights", () => {
    const attrs = calculateInitialAttributes("ST");
    expect(calculateOverall("ST", attrs)).toBe(50);

    const cbAttrs = calculateInitialAttributes("CB");
    expect(calculateOverall("CB", cbAttrs)).toBe(50);
  });

  it("returns the flat baseline overall for a fresh goalkeeper", () => {
    const attrs = calculateInitialAttributes("GK");
    expect(calculateOverall("GK", attrs)).toBe(50);
  });

  it("weights shooting/pace more than defending for a striker", () => {
    const attrs = calculateInitialAttributes("ST");
    const boosted = { ...attrs, shooting: 90, pace: 90, defending: 10 };
    const balanced = { ...attrs, shooting: 50, pace: 50, defending: 50 };

    expect(calculateOverall("ST", boosted)).toBeGreaterThan(calculateOverall("ST", balanced));
  });

  it("weights defending/physical more than shooting for a center-back", () => {
    const attrs = calculateInitialAttributes("CB");
    const boostedDefending = { ...attrs, defending: 90, physical: 90, shooting: 10 };
    const boostedShooting = { ...attrs, defending: 10, physical: 10, shooting: 90 };

    expect(calculateOverall("CB", boostedDefending)).toBeGreaterThan(
      calculateOverall("CB", boostedShooting),
    );
  });
});
