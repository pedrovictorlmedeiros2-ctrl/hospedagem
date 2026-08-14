import type { MatchSimState, PlayerRuntimeStats } from "../domain/state.js";
import type { Side } from "../domain/types.js";
import type { DecisionContext } from "./decide.js";

const TOTAL_MINUTES = 90;

function averageStamina(stats: Map<string, PlayerRuntimeStats>, onPitch: string[]): number {
  if (onPitch.length === 0) return 100;
  const total = onPitch.reduce((sum, id) => sum + (stats.get(id)?.stamina ?? 100), 0);
  return total / onPitch.length;
}

function attackerProgressFor(side: Side, zone: number): number {
  // Home attacks toward zone 4 (AWAY_BOX); away attacks toward zone 0 (HOME_BOX).
  return side === "home" ? zone / 4 : (4 - zone) / 4;
}

/** The "Percepção" step: turns raw match state into the summarized DecisionContext the AI actually reasons over. */
export function perceive(state: MatchSimState, minute: number): DecisionContext {
  const attackingSide = state.possession;
  const defendingSide: Side = attackingSide === "home" ? "away" : "home";
  const attackingTeam = state[attackingSide];
  const defendingTeam = state[defendingSide];

  const attackerScore = attackingSide === "home" ? state.homeScore : state.awayScore;
  const defenderScore = defendingSide === "home" ? state.homeScore : state.awayScore;

  return {
    minute,
    attackerProgress: attackerProgressFor(attackingSide, state.zone),
    scoreDiff: attackerScore - defenderScore,
    attackerStamina: averageStamina(attackingTeam.stats, attackingTeam.onPitch),
    defenderStamina: averageStamina(defendingTeam.stats, defendingTeam.onPitch),
    timeRemaining: Math.max(0, TOTAL_MINUTES - minute),
  };
}
