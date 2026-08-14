import { describe, expect, it } from "vitest";
import { InMemoryCompetitionRepository } from "../../../../src/competitions/adapters/inMemoryCompetitionRepository.js";

function teams(n: number) {
  return Array.from({ length: n }, (_, i) => ({ teamId: `team-${i}`, teamName: `Team ${i}` }));
}

describe("InMemoryCompetitionRepository", () => {
  it("is idempotent — a second call with the same competition name returns the same tournament", async () => {
    const repo = new InMemoryCompetitionRepository();
    const first = await repo.getOrCreateSeasonLeague({ seasonId: "s1", competitionName: "Liga Teste", teams: teams(4) });
    const second = await repo.getOrCreateSeasonLeague({ seasonId: "s1", competitionName: "Liga Teste", teams: teams(4) });

    expect(second.tournamentId).toBe(first.tournamentId);
  });

  it("gives every team a full double round-robin calendar and eventually exhausts it", async () => {
    const repo = new InMemoryCompetitionRepository();
    const { tournamentId } = await repo.getOrCreateSeasonLeague({ seasonId: "s1", competitionName: "Liga Teste", teams: teams(4) });

    let played = 0;
    let fixture = await repo.getNextFixtureForTeam(tournamentId, "team-0");
    while (fixture) {
      await repo.recordFixtureResult(tournamentId, fixture.matchId, 1, 0);
      played += 1;
      fixture = await repo.getNextFixtureForTeam(tournamentId, "team-0");
      if (played > 20) throw new Error("infinite loop guard tripped");
    }

    expect(played).toBe((4 - 1) * 2); // every other team, home and away
  });

  it("never re-offers a fixture that was already recorded", async () => {
    const repo = new InMemoryCompetitionRepository();
    const { tournamentId } = await repo.getOrCreateSeasonLeague({ seasonId: "s1", competitionName: "Liga Teste", teams: teams(4) });

    const first = await repo.getNextFixtureForTeam(tournamentId, "team-0");
    if (!first) throw new Error("expected a fixture");
    await repo.recordFixtureResult(tournamentId, first.matchId, 2, 1);

    const second = await repo.getNextFixtureForTeam(tournamentId, "team-0");
    expect(second?.matchId).not.toBe(first.matchId);
  });

  it("computes standings that reflect recorded results", async () => {
    const repo = new InMemoryCompetitionRepository();
    const { tournamentId } = await repo.getOrCreateSeasonLeague({ seasonId: "s1", competitionName: "Liga Teste", teams: teams(4) });

    const fixture = await repo.getNextFixtureForTeam(tournamentId, "team-0");
    if (!fixture) throw new Error("expected a fixture");
    await repo.recordFixtureResult(tournamentId, fixture.matchId, 3, 0);

    const standings = await repo.getStandings(tournamentId);
    expect(standings).toHaveLength(4);
    const winnerId = fixture.homeTeamId === "team-0" ? "team-0" : fixture.awayTeamId;
    const winnerRow = standings.find((row) => row.teamId === winnerId);
    expect(winnerRow?.points).toBe(3);
    expect(winnerRow?.played).toBe(1);
  });

  it("returns an empty table for an unknown tournament instead of throwing", async () => {
    const repo = new InMemoryCompetitionRepository();
    expect(await repo.getStandings("does-not-exist")).toEqual([]);
  });
});
