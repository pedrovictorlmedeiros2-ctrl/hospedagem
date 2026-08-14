import { describe, expect, it } from "vitest";
import { computeStandings } from "../../../../src/competitions/domain/standings.js";

describe("computeStandings", () => {
  it("gives every team a zeroed row before any results", () => {
    const rows = computeStandings(["A", "B", "C"], []);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toMatchObject({ played: 0, wins: 0, draws: 0, losses: 0, points: 0 });
    }
  });

  it("awards 3 points for a win, 0 for a loss", () => {
    const rows = computeStandings(["A", "B"], [{ homeTeamId: "A", awayTeamId: "B", homeScore: 2, awayScore: 0 }]);
    const a = rows.find((r) => r.teamId === "A");
    const b = rows.find((r) => r.teamId === "B");

    expect(a).toMatchObject({ played: 1, wins: 1, losses: 0, points: 3, goalsFor: 2, goalsAgainst: 0 });
    expect(b).toMatchObject({ played: 1, wins: 0, losses: 1, points: 0, goalsFor: 0, goalsAgainst: 2 });
  });

  it("awards 1 point each for a draw", () => {
    const rows = computeStandings(["A", "B"], [{ homeTeamId: "A", awayTeamId: "B", homeScore: 1, awayScore: 1 }]);
    for (const row of rows) {
      expect(row.draws).toBe(1);
      expect(row.points).toBe(1);
    }
  });

  it("accumulates across multiple results", () => {
    const rows = computeStandings(
      ["A", "B"],
      [
        { homeTeamId: "A", awayTeamId: "B", homeScore: 2, awayScore: 1 },
        { homeTeamId: "B", awayTeamId: "A", homeScore: 3, awayScore: 3 },
      ],
    );
    const a = rows.find((r) => r.teamId === "A");
    expect(a).toMatchObject({ played: 2, wins: 1, draws: 1, losses: 0, points: 4, goalsFor: 5, goalsAgainst: 4, goalDifference: 1 });
  });

  it("sorts by points, then goal difference, then goals for", () => {
    const rows = computeStandings(
      ["A", "B", "C"],
      [
        { homeTeamId: "A", awayTeamId: "B", homeScore: 5, awayScore: 0 }, // A: 3pts, GD +5
        { homeTeamId: "C", awayTeamId: "B", homeScore: 1, awayScore: 0 }, // C: 3pts, GD +1
      ],
    );

    expect(rows.map((r) => r.teamId)).toEqual(["A", "C", "B"]);
  });

  it("ignores a result naming a team outside the table instead of throwing", () => {
    expect(() =>
      computeStandings(["A", "B"], [{ homeTeamId: "A", awayTeamId: "GHOST", homeScore: 1, awayScore: 0 }]),
    ).not.toThrow();
  });
});
