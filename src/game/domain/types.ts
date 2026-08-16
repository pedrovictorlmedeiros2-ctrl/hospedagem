import type { Position } from "@prisma/client";

/**
 * Absolute pitch position, 0..4, NOT relative to whoever has the ball —
 * this is what keeps turnover bookkeeping simple. Home always attacks
 * toward 4 (AWAY_BOX); away always attacks toward 0 (HOME_BOX).
 */
export type PitchZone = 0 | 1 | 2 | 3 | 4;
export const HOME_BOX: PitchZone = 0;
export const HOME_THIRD: PitchZone = 1;
export const MIDFIELD: PitchZone = 2;
export const AWAY_THIRD: PitchZone = 3;
export const AWAY_BOX: PitchZone = 4;

export const ZONE_LABELS: Record<PitchZone, string> = {
  0: "área do mandante",
  1: "terço defensivo do mandante",
  2: "meio-campo",
  3: "terço defensivo do visitante",
  4: "área do visitante",
};

export type Side = "home" | "away";

export type TeamStyle =
  "DEFENSIVE" | "AGGRESSIVE" | "POSSESSION" | "COUNTER_ATTACK" | "DRIBBLING" | "TACTICAL";

export type AttackAction = "HOLD" | "PASS" | "DRIBBLE" | "SHOOT" | "CROSS";
export type DefenseReaction = "DEFEND" | "PRESS" | "RECOVER";

export interface MatchPlayerInput {
  id: string;
  name: string;
  position: Position;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  gkReflexes: number | null;
  gkPositioning: number | null;
  gkHandling: number | null;
  gkAerial: number | null;
  gkOneOnOne: number | null;
  gkPenalties: number | null;
}

export interface MatchSquad {
  teamId: string;
  teamName: string;
  style: TeamStyle;
  /** First 11 by array order are the starting lineup; the rest is the bench, in substitution priority order. */
  players: MatchPlayerInput[];
}

export type SimMatchEventType =
  | "KICKOFF"
  | "GOAL"
  | "OWN_GOAL"
  | "YELLOW_CARD"
  | "RED_CARD"
  | "SUBSTITUTION"
  | "INJURY"
  | "PENALTY_SCORED"
  | "PENALTY_MISSED"
  | "CORNER"
  | "OFFSIDE"
  | "HALFTIME"
  | "FULLTIME";

export interface SimMatchEvent {
  minute: number;
  type: SimMatchEventType;
  side: Side | null;
  playerId: string | null;
  metadata?: Record<string, unknown>;
}

export interface MatchPlayerStatLine {
  playerId: string;
  side: Side;
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  passesCompleted: number;
  tackles: number;
  interceptions: number;
  saves: number;
  goalsConceded: number;
  rating: number;
  /** Stamina (0-100) at full-time — an unused substitute ends at 100, same as they started. */
  staminaRemaining: number;
}

export interface MatchResult {
  seed: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homePossessionPct: number;
  events: SimMatchEvent[];
  playerStats: MatchPlayerStatLine[];
  log: string[];
}

export interface MatchOptions {
  seed: string;
  /**
   * When true, a penalty is NOT resolved inline — the engine defers it
   * (see MatchSimState.pendingPenalty in game/domain/state.ts) and the
   * caller must call resumePendingPenalty (game/engine/simulateMatch.ts)
   * to continue. Every existing caller omits this and gets byte-identical
   * behavior to before this option existed. Only honored by
   * simulateFirstHalf/simulateUntilMinute — simulateSecondHalf always
   * resolves penalties inline regardless (see its doc comment for why).
   */
  pauseOnPenalty?: boolean;
  /**
   * Same idea as `pauseOnPenalty`, for a stamina-driven substitution
   * instead — see MatchSimState.pendingSubstitution and
   * resumePendingSubstitution. Also only honored by
   * simulateFirstHalf/simulateUntilMinute, never simulateSecondHalf.
   */
  pauseOnSubstitution?: boolean;
}
