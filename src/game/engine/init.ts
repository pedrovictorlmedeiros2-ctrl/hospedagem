import { createPatternMemory } from "../ai/pattern.js";
import type { Rng } from "../domain/rng.js";
import type { MatchSimState, PlayerRuntimeStats, TeamRuntimeState } from "../domain/state.js";
import { MIDFIELD, type MatchSquad } from "../domain/types.js";

function initialStats(): PlayerRuntimeStats {
  return {
    minutesPlayed: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    passesCompleted: 0,
    tackles: 0,
    interceptions: 0,
    saves: 0,
    goalsConceded: 0,
    yellowCards: 0,
    redCarded: false,
    stamina: 100,
  };
}

function initTeamState(squad: MatchSquad): TeamRuntimeState {
  const starters = squad.players.slice(0, 11);
  const bench = squad.players.slice(11);
  const stats = new Map<string, PlayerRuntimeStats>();
  for (const player of squad.players) {
    stats.set(player.id, initialStats());
  }

  return {
    squad,
    onPitch: starters.map((player) => player.id),
    bench: bench.map((player) => player.id),
    stats,
    pattern: createPatternMemory(),
  };
}

export function initMatchState(home: MatchSquad, away: MatchSquad, rng: Rng): MatchSimState {
  return {
    home: initTeamState(home),
    away: initTeamState(away),
    zone: MIDFIELD,
    possession: rng() < 0.5 ? "home" : "away",
    homeScore: 0,
    awayScore: 0,
    possessionMinutes: { home: 0, away: 0 },
  };
}
