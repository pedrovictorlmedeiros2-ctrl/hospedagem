import type { CareerStage, InjurySeverity } from "@prisma/client";

export interface SeasonRecord {
  id: string;
  name: string;
  number: number;
}

export interface ClubRecord {
  id: string;
  name: string;
  country: string;
  tier: number;
  reputation: number;
}

export interface TeamRecord {
  id: string;
  name: string;
  clubId: string | null;
  seasonId: string;
}

export interface CareerRecord {
  id: string;
  playerId: string;
  stage: CareerStage;
  /** Which Season.number this career's league is currently on — see CareerRepository.advanceCareerSeason. */
  currentSeasonNumber: number;
  currentClubId: string | null;
  debutAt: Date | null;
  isRetired: boolean;
}

export interface GetOrCreateClubInput {
  /** Stable business key — same key always resolves to the same club, across every caller. */
  externalKey: string;
  name: string;
  country: string;
  tier: number;
  reputation: number;
}

export interface GetOrCreateTeamInput {
  clubId: string;
  seasonId: string;
  name: string;
}

export interface EnsureOnRosterInput {
  teamId: string;
  playerId: string;
  squadNumber: number | null;
}

export interface CreateCareerInput {
  playerId: string;
  clubId: string;
  stage: CareerStage;
  debutAt: Date;
}

export interface RecordInjuryInput {
  playerId: string;
  severity: InjurySeverity;
  diagnosis: string;
  occurredAt: Date;
  expectedReturnAt: Date;
}

/**
 * Port for the "career world": seasons, clubs, team rosters and the
 * player's own Career record. Deliberately one cohesive port rather than
 * four tiny ones — these are managed together as a single bounded context
 * (see docs/adr/0001, Fase 4 addendum) and splitting them further would be
 * abstraction for its own sake.
 */
export interface CareerRepository {
  /**
   * Idempotent get-or-create for a specific season NUMBER — there is no
   * single "the active season" anymore (see Career.currentSeasonNumber):
   * each career advances its own season independently the moment it
   * exhausts its current fixtures. `now` is only used the first time this
   * number is ever created (sets Season.startsAt); ignored on every
   * subsequent call for the same number.
   */
  getOrCreateSeason(number: number, now: Date): Promise<SeasonRecord>;
  getOrCreateClub(input: GetOrCreateClubInput): Promise<ClubRecord>;
  /** Throws if the id doesn't exist — callers only ever pass a `Career.currentClubId` that was itself written by this repository, so a miss means data corruption, not a normal "not found". */
  getClubById(clubId: string): Promise<ClubRecord>;
  /** Resolves the club that owns a given Team — used to price/name an opponent generically (any team in the league), not just the fixed rival pool. Null only if the team has no club (e.g. a NATIONAL team, not applicable in the career flow). */
  getClubByTeamId(teamId: string): Promise<ClubRecord | null>;
  getOrCreateTeam(input: GetOrCreateTeamInput): Promise<TeamRecord>;
  ensureOnRoster(input: EnsureOnRosterInput): Promise<void>;
  /** Ends the player's active roster membership on a team (e.g. the losing side of a transfer). A no-op if they weren't on it. */
  leaveRoster(teamId: string, playerId: string, now: Date): Promise<void>;
  getCareer(playerId: string): Promise<CareerRecord | null>;
  createCareer(input: CreateCareerInput): Promise<CareerRecord>;
  updateCareerStage(playerId: string, stage: CareerStage): Promise<CareerRecord>;
  /** Points the career at a new current club — the roster move itself (leaveRoster + ensureOnRoster) is a separate call, see career/services (transfer flow). */
  updateCareerClub(playerId: string, clubId: string): Promise<CareerRecord>;
  /** Advances a career onto a new season number — called once a player exhausts their current season's league fixtures (see career/services/playCareerMatch.ts). The Season row itself must already exist (getOrCreateSeason first). */
  advanceCareerSeason(playerId: string, seasonNumber: number): Promise<CareerRecord>;
  recordInjury(input: RecordInjuryInput): Promise<void>;
  /** True if the player has a recorded injury whose expected recovery date is still in the future. */
  hasActiveInjury(playerId: string, now: Date): Promise<boolean>;
}
