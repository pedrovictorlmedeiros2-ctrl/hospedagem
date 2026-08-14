import type { AttackAction, MatchSquad, PitchZone, Side } from "./types.js";

export interface PlayerRuntimeStats {
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  passesCompleted: number;
  tackles: number;
  interceptions: number;
  saves: number;
  goalsConceded: number;
  yellowCards: number;
  redCarded: boolean;
  stamina: number; // 0-100
}

/** Tracks the attacking side's recent choices so the defense can "learn" a repeated pattern — see ai/pattern.ts. */
export interface PatternMemory {
  recentActions: AttackAction[];
}

export interface TeamRuntimeState {
  squad: MatchSquad;
  /** Player ids currently on the pitch — starts as the first 11 of `squad.players`, changes on substitution/red card. */
  onPitch: string[];
  /** Remaining bench ids, in substitution priority order. */
  bench: string[];
  stats: Map<string, PlayerRuntimeStats>;
  pattern: PatternMemory;
}

export interface MatchSimState {
  home: TeamRuntimeState;
  away: TeamRuntimeState;
  zone: PitchZone;
  possession: Side;
  homeScore: number;
  awayScore: number;
  /** Minutes each side spent in possession — the source for the final possession percentage stat. */
  possessionMinutes: { home: number; away: number };
}
