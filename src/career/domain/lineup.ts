export type LineupStatus = "STARTING" | "BENCH";

const MIN_STAMINA_TO_START = 40;

export interface LineupDecisionInput {
  stamina: number;
  hasActiveInjury: boolean;
}

/** The "escalação" mechanic for a single-player squad: the coach benches you if you're hurt or too tired to start, and a synthetic teammate covers instead. */
export function decideLineupStatus(input: LineupDecisionInput): LineupStatus {
  if (input.hasActiveInjury) return "BENCH";
  if (input.stamina < MIN_STAMINA_TO_START) return "BENCH";
  return "STARTING";
}
