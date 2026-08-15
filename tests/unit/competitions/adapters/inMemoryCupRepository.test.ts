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

  it("eliminates the loser permanently — no fixture ever again", async () => {
    const { tournamentId } = await makeTournament(repo);
    const fixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    if (!fixture) throw new Error("expected a QF fixture");
    await repo.recordFixtureResult(tournamentId, fixture.matchId, 2, 1); // team-1 beats team-8

    expect(await repo.getNextFixtureForTeam(tournamentId, "team-8")).toBeNull();
  });

  it("advances the winner to SEMI_FINAL immediately — no other player exists to play the sibling QF matches, so they're auto-resolved", async () => {
    const { tournamentId } = await makeTournament(repo);

    const fixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    if (!fixture) throw new Error("expected a QF fixture");
    const homeWins = fixture.homeTeamId === "team-1";
    await repo.recordFixtureResult(tournamentId, fixture.matchId, homeWins ? 3 : 0, homeWins ? 0 : 3);

    const status = await repo.getStatus(tournamentId);
    expect(status.stages.filter((s) => s.stage === "QUARTER_FINAL" && s.homeScore !== null)).toHaveLength(4);

    const semiFixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    expect(semiFixture?.stage).toBe("SEMI_FINAL");
  });

  it("plays a full bracket down to a champion, only ever recording the real team's own matches", async () => {
    const { tournamentId } = await makeTournament(repo);

    for (const expectedStage of ["QUARTER_FINAL", "SEMI_FINAL", "FINAL"] as const) {
      const fixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
      expect(fixture?.stage).toBe(expectedStage);
      if (!fixture) throw new Error(`expected a ${expectedStage} fixture`);
      const homeWins = fixture.homeTeamId === "team-1";
      await repo.recordFixtureResult(tournamentId, fixture.matchId, homeWins ? 3 : 0, homeWins ? 0 : 3);
    }

    const finalStatus = await repo.getStatus(tournamentId);
    expect(finalStatus.championTeamName).toBe("Team 1");
    expect(await repo.getNextFixtureForTeam(tournamentId, "team-1")).toBeNull();
  });

  it("cascades all the way to a champion when realTeamId is eliminated — nobody else would ever push the bracket forward", async () => {
    const { tournamentId } = await makeTournament(repo);
    const fixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    if (!fixture) throw new Error("expected a QF fixture");
    const homeWins = fixture.homeTeamId === "team-1";

    // team-1 LOSES its own match — pass realTeamId so the repo knows
    // nobody will ever call this again on team-1's behalf.
    await repo.recordFixtureResult(tournamentId, fixture.matchId, homeWins ? 0 : 3, homeWins ? 3 : 0, "team-1");

    const status = await repo.getStatus(tournamentId);
    expect(status.championTeamName).toBeTruthy();
    expect(status.stages.filter((s) => s.stage === "FINAL")).toHaveLength(1);
    expect(status.stages.every((s) => s.homeScore !== null)).toBe(true);
  });

  it("does NOT cascade past one round when realTeamId is omitted, even if that team just lost", async () => {
    const { tournamentId } = await makeTournament(repo);
    const fixture = await repo.getNextFixtureForTeam(tournamentId, "team-1");
    if (!fixture) throw new Error("expected a QF fixture");
    const homeWins = fixture.homeTeamId === "team-1";

    await repo.recordFixtureResult(tournamentId, fixture.matchId, homeWins ? 0 : 3, homeWins ? 3 : 0);

    const status = await repo.getStatus(tournamentId);
    expect(status.championTeamName).toBeNull();
    expect(status.stages.filter((s) => s.stage === "SEMI_FINAL")).toHaveLength(2);
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
