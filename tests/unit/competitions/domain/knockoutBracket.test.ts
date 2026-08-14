import { describe, expect, it } from "vitest";
import { generateKnockoutBracket, InvalidBracketSizeError } from "../../../../src/competitions/domain/knockoutBracket.js";

describe("generateKnockoutBracket", () => {
  it("rejects a team count that isn't a power of two", () => {
    expect(() => generateKnockoutBracket(["A", "B", "C"])).toThrow(InvalidBracketSizeError);
  });

  it("rejects a duplicate team id", () => {
    expect(() => generateKnockoutBracket(["A", "A"])).toThrow();
  });

  it("builds QUARTER_FINAL -> SEMI_FINAL -> FINAL for 8 teams", () => {
    const teams = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const stages = generateKnockoutBracket(teams);

    expect(stages.map((s) => s.type)).toEqual(["QUARTER_FINAL", "SEMI_FINAL", "FINAL"]);
    expect(stages.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  it("fills every team into the first stage exactly once, seeded 1-vs-last", () => {
    const teams = ["A", "B", "C", "D"];
    const [firstStage] = generateKnockoutBracket(teams);

    expect(firstStage?.matches).toEqual([
      { homeTeamId: "A", awayTeamId: "D" },
      { homeTeamId: "B", awayTeamId: "C" },
    ]);
  });

  it("leaves later stages empty — they depend on results the pure function doesn't know", () => {
    const teams = ["A", "B", "C", "D"];
    const stages = generateKnockoutBracket(teams);

    expect(stages[1]?.matches).toEqual([]);
  });

  it("builds a single FINAL stage for a 2-team bracket", () => {
    const stages = generateKnockoutBracket(["A", "B"]);
    expect(stages).toEqual([{ type: "FINAL", order: 1, matches: [{ homeTeamId: "A", awayTeamId: "B" }] }]);
  });
});
