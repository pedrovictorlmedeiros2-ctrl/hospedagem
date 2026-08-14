import { describe, expect, it } from "vitest";
import { decideLineupStatus } from "../../../../src/career/domain/lineup.js";

describe("decideLineupStatus", () => {
  it("starts a fit, uninjured player", () => {
    expect(decideLineupStatus({ stamina: 90, hasActiveInjury: false })).toBe("STARTING");
  });

  it("benches an injured player regardless of stamina", () => {
    expect(decideLineupStatus({ stamina: 100, hasActiveInjury: true })).toBe("BENCH");
  });

  it("benches an exhausted player", () => {
    expect(decideLineupStatus({ stamina: 10, hasActiveInjury: false })).toBe("BENCH");
  });
});
