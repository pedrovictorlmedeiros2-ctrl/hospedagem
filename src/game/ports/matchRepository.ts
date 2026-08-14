import type { MatchResult, Side } from "../domain/types.js";

/**
 * Only ONE player in a simulated match corresponds to a real, persisted
 * `Player` row — every teammate/opponent is synthetic filler (see
 * game/domain/generateSquad.ts and career/services/playCareerMatch.ts).
 * `matchPlayerInputId` is that player's id *inside the engine*
 * (MatchPlayerInput.id, e.g. "real-<playerId>") — the adapter uses it to
 * tell which SimMatchEvent rows belong to the real player (gets a real
 * `MatchEvent.playerId`) versus everyone else (persisted with
 * `playerId: null`, since there's no Player row to point at).
 */
export interface RealPlayerMatchContribution {
  playerId: string;
  matchPlayerInputId: string;
  side: Side;
}

export interface PersistMatchResultInput {
  homeTeamId: string;
  awayTeamId: string;
  seasonId: string;
  scheduledAt: Date;
  result: MatchResult;
  realPlayer: RealPlayerMatchContribution;
}

export interface PersistedSeasonStat {
  matches: number;
  goals: number;
  assists: number;
  avgRating: number;
}

export interface PersistedMatch {
  matchId: string;
  /** The real player's season aggregate *after* this match was folded in — callers use this for career-stage progression without a second read. */
  seasonStat: PersistedSeasonStat;
}

/**
 * Persists a simulated match and everything strictly derived from *the
 * match result itself* (events, the real player's stat line, their season
 * aggregate) as a single atomic operation — a Match row must never exist
 * without its stats, or vice versa. Injuries are NOT written here — an
 * injury is career/fitness state, not match-result state, and is recorded
 * separately via CareerRepository.recordInjury (see
 * career/services/playCareerMatch.ts for why that's an accepted,
 * documented trade-off rather than a single cross-repository transaction).
 */
export interface MatchRepository {
  persistMatchResult(input: PersistMatchResultInput): Promise<PersistedMatch>;
  getPlayerSeasonStat(playerId: string, seasonId: string): Promise<PersistedSeasonStat | null>;
}
