export interface LeagueTeamInput {
  teamId: string;
  teamName: string;
}

export interface GetOrCreateSeasonLeagueInput {
  seasonId: string;
  /**
   * Unique per league — today this is one league per starter-club region
   * (see career/services/playCareerMatch.ts), e.g. "Campeonato Nacional 🇧🇷 Série A".
   * The pair (competitionName, seasonId) is only ever generated once;
   * calling again with the same pair is a cheap idempotent read, never a
   * regeneration (mid-season roster changes are out of scope — see ADR
   * 0001, Fase 5 addendum). The SAME competitionName is expected to
   * recur across seasons — that's a new Tournament for the same
   * long-running competition, not a collision (see ADR 0001, adenda
   * temporadas).
   */
  competitionName: string;
  teams: LeagueTeamInput[];
}

export interface FixtureRecord {
  matchId: string;
  tournamentId: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
}

export interface StandingRowRecord {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface CompetitionRepository {
  /** Idempotent: generates the full double round-robin calendar (as SCHEDULED Match rows) exactly once per competition name. */
  getOrCreateSeasonLeague(input: GetOrCreateSeasonLeagueInput): Promise<{ tournamentId: string }>;
  /** The earliest not-yet-played fixture involving this team, or null once the season is complete. */
  getNextFixtureForTeam(tournamentId: string, teamId: string): Promise<FixtureRecord | null>;
  /**
   * Marks a fixture as played with its final score. Not atomic with
   * `MatchRepository.persistMatchResult` (same documented trade-off as
   * `CareerRepository.recordInjury` — see ADR 0001, Fase 4/5 addenda):
   * the Match row itself is already updated to FINISHED by that call,
   * this only updates this repository's own view of "what's left to
   * schedule" and the standings table. Worst case of a failure between
   * the two calls is a fixture that looks not-yet-played and gets
   * offered again — an annoying re-play, not data corruption or a wrong
   * standings table (the Prisma adapter recomputes standings straight
   * from `Match` rows, so it can never disagree with what was actually
   * persisted).
   */
  recordFixtureResult(tournamentId: string, matchId: string, homeScore: number, awayScore: number): Promise<void>;
  getStandings(tournamentId: string): Promise<StandingRowRecord[]>;
}
