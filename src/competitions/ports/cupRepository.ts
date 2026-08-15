import type { StageType } from "@prisma/client";

export interface CupTeamInput {
  teamId: string;
  teamName: string;
}

export interface GetOrCreateSeasonCupInput {
  seasonId: string;
  /** Unique per cup, same idea as CompetitionRepository's competitionName — see its doc comment. */
  competitionName: string;
  /** Must be a power of 2 — see competitions/domain/knockoutBracket.ts. */
  teams: CupTeamInput[];
}

export interface CupFixtureRecord {
  matchId: string;
  tournamentId: string;
  stage: StageType;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
}

export interface CupStageMatchRecord {
  stage: StageType;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamName: string | null;
}

export interface CupStatusRecord {
  tournamentId: string;
  /** In stage order; only stages generated so far (later rounds don't exist until their previous round is fully decided). */
  stages: CupStageMatchRecord[];
  championTeamName: string | null;
}

/**
 * Single-elimination cup running parallel to the league (see
 * CompetitionRepository) — same season, same pool of clubs plus one
 * wildcard to round the count to a power of 2 (see
 * career/services/ensureLeagueTeams.ts's ensureCupWildcardTeam), but a
 * completely different fixture shape: only the next round's matches exist
 * at any time, generated from the previous round's winners instead of a
 * fixed calendar known upfront.
 */
export interface CupRepository {
  /** Idempotent: generates the full bracket (first round only — later rounds fill in as previous ones are decided) exactly once per cup name. */
  getOrCreateSeasonCup(input: GetOrCreateSeasonCupInput): Promise<{ tournamentId: string }>;
  /** The team's current live match, or null if eliminated, waiting on the other half of the bracket to finish, or the cup is already over. */
  getNextFixtureForTeam(tournamentId: string, teamId: string): Promise<CupFixtureRecord | null>;
  /**
   * Records a result and, once every match in that round is decided,
   * generates the next round's fixtures from the winners (or leaves the
   * bracket complete if this was the FINAL). Draws are resolved by
   * resolveCupWinner (deterministic shootout) — a knockout round never
   * ends undecided.
   */
  recordFixtureResult(tournamentId: string, matchId: string, homeScore: number, awayScore: number): Promise<void>;
  getStatus(tournamentId: string): Promise<CupStatusRecord>;
}
