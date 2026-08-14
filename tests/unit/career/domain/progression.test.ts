import { describe, expect, it } from "vitest";
import { nextCareerStage } from "../../../../src/career/domain/progression.js";

describe("nextCareerStage", () => {
  it("keeps a reserve player in RESERVE without enough appearances", () => {
    expect(nextCareerStage("RESERVE", 1, 8.0)).toBe("RESERVE");
  });

  it("keeps a reserve player in RESERVE with enough appearances but poor form", () => {
    expect(nextCareerStage("RESERVE", 5, 5.5)).toBe("RESERVE");
  });

  it("promotes RESERVE to PROFESSIONAL once appearances and form both clear the bar", () => {
    expect(nextCareerStage("RESERVE", 3, 6.5)).toBe("PROFESSIONAL");
  });

  it("promotes PROFESSIONAL to STARTER once appearances and form both clear the higher bar", () => {
    expect(nextCareerStage("PROFESSIONAL", 8, 7.0)).toBe("STARTER");
  });

  it("does not skip stages in a single call", () => {
    expect(nextCareerStage("RESERVE", 100, 10)).toBe("PROFESSIONAL");
  });

  it("leaves an already-advanced stage untouched by this rule", () => {
    expect(nextCareerStage("STARTER", 100, 10)).toBe("STARTER");
  });
});
