import { describe, expect, it } from "vitest";
import { generateRoundRobinFixtures } from "../../../../src/competitions/domain/fixtures.js";

function countAppearances(fixtures: { homeTeamId: string; awayTeamId: string }[], teamId: string): number {
  return fixtures.filter((f) => f.homeTeamId === teamId || f.awayTeamId === teamId).length;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

describe("generateRoundRobinFixtures", () => {
  it("rejects fewer than 2 teams", () => {
    expect(() => generateRoundRobinFixtures(["A"])).toThrow();
  });

  it("rejects a duplicate team id", () => {
    expect(() => generateRoundRobinFixtures(["A", "B", "A"])).toThrow();
  });

  it("never schedules a team against itself", () => {
    const fixtures = generateRoundRobinFixtures(["A", "B", "C", "D", "E"]);
    for (const fixture of fixtures) {
      expect(fixture.homeTeamId).not.toBe(fixture.awayTeamId);
    }
  });

  it("never leaks the internal bye placeholder for an odd team count", () => {
    const fixtures = generateRoundRobinFixtures(["A", "B", "C", "D", "E"]);
    for (const fixture of fixtures) {
      expect(fixture.homeTeamId).not.toMatch(/BYE/);
      expect(fixture.awayTeamId).not.toMatch(/BYE/);
    }
  });

  it("pairs every team with every other team exactly once (single round, even count)", () => {
    const teams = ["A", "B", "C", "D"];
    const fixtures = generateRoundRobinFixtures(teams);

    expect(fixtures).toHaveLength(6); // C(4,2)
    const seen = new Set(fixtures.map((f) => pairKey(f.homeTeamId, f.awayTeamId)));
    expect(seen.size).toBe(6);
    for (const team of teams) {
      expect(countAppearances(fixtures, team)).toBe(3); // n - 1
    }
  });

  it("pairs every team with every other team exactly once (single round, odd count)", () => {
    const teams = ["A", "B", "C", "D", "E"];
    const fixtures = generateRoundRobinFixtures(teams);

    expect(fixtures).toHaveLength(10); // C(5,2)
    for (const team of teams) {
      expect(countAppearances(fixtures, team)).toBe(4); // n - 1
    }
  });

  it("doubles the schedule with swapped home/away for doubleRound", () => {
    const teams = ["A", "B", "C", "D", "E", "F", "G"];
    const single = generateRoundRobinFixtures(teams);
    const double = generateRoundRobinFixtures(teams, { doubleRound: true });

    expect(double).toHaveLength(single.length * 2);
    for (const team of teams) {
      expect(countAppearances(double, team)).toBe((teams.length - 1) * 2);
    }

    const secondLeg = double.slice(single.length);
    for (let i = 0; i < single.length; i++) {
      expect(secondLeg[i]?.homeTeamId).toBe(single[i]?.awayTeamId);
      expect(secondLeg[i]?.awayTeamId).toBe(single[i]?.homeTeamId);
    }
  });

  it("gives every fixture a positive round number", () => {
    const fixtures = generateRoundRobinFixtures(["A", "B", "C", "D", "E", "F"], { doubleRound: true });
    for (const fixture of fixtures) {
      expect(fixture.round).toBeGreaterThan(0);
    }
  });
});
