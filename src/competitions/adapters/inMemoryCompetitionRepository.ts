import { randomUUID } from "node:crypto";
import { generateRoundRobinFixtures } from "../domain/fixtures.js";
import { computeStandings, type FinishedResult } from "../domain/standings.js";
import type {
  CompetitionRepository,
  FixtureRecord,
  GetOrCreateSeasonLeagueInput,
  StandingRowRecord,
} from "../ports/competitionRepository.js";

interface InternalFixture extends FixtureRecord {
  round: number;
}

interface TournamentState {
  teams: { teamId: string; teamName: string }[];
  fixtures: InternalFixture[];
  finished: Map<string, FinishedResult>; // matchId -> result
}

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryCompetitionRepository implements CompetitionRepository {
  private readonly tournamentIdByCompetitionName = new Map<string, string>();
  private readonly tournaments = new Map<string, TournamentState>();

  async getOrCreateSeasonLeague(input: GetOrCreateSeasonLeagueInput): Promise<{ tournamentId: string }> {
    const existing = this.tournamentIdByCompetitionName.get(input.competitionName);
    if (existing) return { tournamentId: existing };

    const tournamentId = randomUUID();
    this.tournamentIdByCompetitionName.set(input.competitionName, tournamentId);

    const teamNameById = new Map(input.teams.map((team) => [team.teamId, team.teamName]));
    const schedule = generateRoundRobinFixtures(
      input.teams.map((team) => team.teamId),
      { doubleRound: true },
    );

    const fixtures: InternalFixture[] = schedule.map((fixture) => ({
      matchId: randomUUID(),
      tournamentId,
      round: fixture.round,
      homeTeamId: fixture.homeTeamId,
      homeTeamName: teamNameById.get(fixture.homeTeamId) ?? fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      awayTeamName: teamNameById.get(fixture.awayTeamId) ?? fixture.awayTeamId,
    }));

    this.tournaments.set(tournamentId, { teams: input.teams, fixtures, finished: new Map() });
    return { tournamentId };
  }

  async getNextFixtureForTeam(tournamentId: string, teamId: string): Promise<FixtureRecord | null> {
    const state = this.tournaments.get(tournamentId);
    if (!state) return null;

    const upcoming = state.fixtures
      .filter((fixture) => (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId) && !state.finished.has(fixture.matchId))
      .sort((a, b) => a.round - b.round);

    const next = upcoming[0];
    if (!next) return null;

    const { round: _round, ...fixtureRecord } = next;
    void _round;
    return fixtureRecord;
  }

  async recordFixtureResult(tournamentId: string, matchId: string, homeScore: number, awayScore: number): Promise<void> {
    const state = this.tournaments.get(tournamentId);
    if (!state) return;
    const fixture = state.fixtures.find((candidate) => candidate.matchId === matchId);
    if (!fixture) return;

    state.finished.set(matchId, { homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId, homeScore, awayScore });
  }

  async getStandings(tournamentId: string): Promise<StandingRowRecord[]> {
    const state = this.tournaments.get(tournamentId);
    if (!state) return [];

    const results = [...state.finished.values()];
    const rows = computeStandings(
      state.teams.map((team) => team.teamId),
      results,
    );
    const teamNameById = new Map(state.teams.map((team) => [team.teamId, team.teamName]));

    return rows.map((row) => ({ ...row, teamName: teamNameById.get(row.teamId) ?? row.teamId }));
  }
}
