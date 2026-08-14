export type DuelPersonalResult = "WIN" | "DRAW" | "LOSS";

const REWARD_BY_RESULT: Record<DuelPersonalResult, number> = {
  WIN: 40,
  DRAW: 20,
  LOSS: 10,
};

/** Both sides always get something (never zero) — a duel costs nothing to enter, so even the loser walks away with a small consolation instead of feeling like they wasted their time. */
export function calculateDuelReward(result: DuelPersonalResult): number {
  return REWARD_BY_RESULT[result];
}
