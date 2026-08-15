import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryCupRepository } from "../../../../src/competitions/adapters/inMemoryCupRepository.js";

const TEAMS = Array.from({ length: 8 }, (_, i) => ({ teamId: `team-${i + 1}`, teamName: `Team ${i + 1}` }));

function makeTournament(repo: InMemoryCupRepository) {
  return repo.getOrCreateSeasonCup({ seasonId: "season-1", competitionName: "Copa Teste", teams: TEAMS });
}

describe("InMemoryCupRepository", () => {
  let repo: InMemoryCupRepository;

  beforeEach(() => {
    repo = new InMemoryCupRepository();
  });

  it("is idempotent per competitionName+seasonId", async () => {
    const first = await makeTournament(repo);
    const second = await makeTournament(repo);
    expect(second.tournamentId).toBe(first.tournamentId);
  });

  it("seeds the first round as 1vN, 2vN-1, ...", async () => {
    const { tournamentId } = await makeTournament(repo);
    const fixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    expect(fixture?.stage).toBe("QUARTER_FINAL");
    expect(fixture?.awayTeamId).toBe("team-8");
  });

  it("returns null for a team with no pending match yet (round not fully decided)", async () => {
    const { tournamentId } = await makeTournament(repo);
    const fixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    if (!fixture) throw new Error("expected a QF fixture");
    await repo.recordFixtureResult(tournamentId, fixture.matchId, 2, 1);

    expect(await repo.getNextFixtureForTeam(tournamentId, "team-1")).toBeNull();
  });

  it("eliminates the loser permanently — no fixture ever again", async () => {
    const { tournamentId } = await makeTournament(repo);
    const fixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    if (!fixture) throw new Error("expected a QF fixture");
    await repo.recordFixtureResult(tournamentId, fixture.matchId, 2, 1); // team-1 beats team-8

    expect(await repo.getNextFixtureForTeam(tournamentId, "team-8")).toBeNull();
  });

  it("advances to SEMI_FINAL only once every QUARTER_FINAL match is decided", async () => {
    const { tournamentId } = await makeTournament(repo);

    for (const teamId of ["team-1", "team-2", "team-3"]) {
      const fixture = await repo.getNextFixtureForTeam(tournamentId, teamId);
      if (!fixture) throw new Error(`expected a QF fixture for ${teamId}`);
      await repo.recordFixtureResult(tournamentId, fixture.matchId, 3, 0);
    }
    expect(await repo.getNextFixtureForTeam(tournamentId, "team-1")).toBeNull();

    const lastFixture = await repo.getNextFixtureForTeam(tournamentId, "team-4");
    if (!lastFixture) throw new Error("expected the last QF fixture");
    await repo.recordFixtureResult(tournamentId, lastFixture.matchId, 3, 0);

    const semiFixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    expect(semiFixture?.stage).toBe("SEMI_FINAL");
  });

  it("plays a full bracket down to a champion", async () => {
    const { tournamentId } = await makeTournament(repo);

    // team-1, team-2, team-3, team-4 win every round they're in.
    const winners = ["team-1", "team-2", "team-3", "team-4"];
    for (const teamId of winners) {
      const fixture = await repo.getNextFixtureForTeam(tournamentId, teamId);
      if (!fixture) throw new Error(`expected a QF fixture for ${teamId}`);
      const homeWins = fixture.homeTeamId === teamId;
      await repo.recordFixtureResult(tournamentId, fixture.matchId, homeWins ? 3 : 0, homeWins ? 0 : 3);
    }

    const statusAfterQf = await repo.getStatus(tournamentId);
    expect(statusAfterQf.stages.filter((s) => s.stage === "QUARTER_FINAL")).toHaveLength(4);
    expect(statusAfterQf.championTeamName).toBeNull();

    for (const teamId of ["team-1", "team-3"]) {
      const fixture = await repo.getNextFixtureForTeam(tournamentId, teamId);
      if (!fixture) throw new Error(`expected a SF fixture for ${teamId}`);
      const homeWins = fixture.homeTeamId === teamId;
      await repo.recordFixtureResult(tournamentId, fixture.matchId, homeWins ? 2 : 0, homeWins ? 0 : 2);
    }

    const finalFixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    expect(finalFixture?.stage).toBe("FINAL");
    if (!finalFixture) throw new Error("expected a FINAL fixture");
    const homeWins = finalFixture.homeTeamId === "team-1";
    await repo.recordFixtureResult(tournamentId, finalFixture.matchId, homeWins ? 1 : 0, homeWins ? 0 : 1);

    const finalStatus = await repo.getStatus(tournamentId);
    expect(finalStatus.championTeamName).toBe("Team 1");
    expect(await repo.getNextFixtureForTeam(tournamentId, "team-1")).toBeNull();
  });

  it("resolves a draw deterministically instead of leaving the round undecided", async () => {
    const { tournamentId } = await makeTournament(repo);
    const fixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    if (!fixture) throw new Error("expected a QF fixture");

    await repo.recordFixtureResult(tournamentId, fixture.matchId, 1, 1);

    const status = await repo.getStatus(tournamentId);
    const row = status.stages.find((s) => s.homeScore === 1 && s.awayScore === 1);
    expect(row?.winnerTeamName).toBeTruthy();
  });
});
