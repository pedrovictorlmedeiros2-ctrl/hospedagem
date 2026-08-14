export type MatchOutcome = "WIN" | "DRAW" | "LOSS";
export type RewardLineupStatus = "STARTING" | "BENCH";

export interface MatchRewardInput {
  outcome: MatchOutcome;
  lineupStatus: RewardLineupStatus;
  goals: number;
  assists: number;
  rating: number;
}

const BENCH_PARTICIPATION = 15;
const STARTING_PARTICIPATION = 30;
const OUTCOME_BONUS: Record<MatchOutcome, number> = {
  WIN: 60,
  DRAW: 25,
  LOSS: 5,
};
const GOAL_BONUS = 15;
const ASSIST_BONUS = 10;
const MAN_OF_THE_MATCH_RATING = 8.0;
const MAN_OF_THE_MATCH_BONUS = 25;

/**
 * Coin reward for a single career match. Weights are hand-tuned for a v1,
 * not calibrated against real economy data — same accepted risk category
 * as the match-engine AI weights (see docs/RISK_REGISTER.md). Bench
 * players still earn a small, flat participation reward (never zero, and
 * never dependent on the match result they didn't play in) so sitting out
 * isn't punished on top of already not playing — but the gap versus
 * starting is intentionally large enough that queuing for the bench is
 * never the "optimal" farming strategy.
 */
export function calculateMatchReward(input: MatchRewardInput): number {
  if (input.lineupStatus === "BENCH") {
    return BENCH_PARTICIPATION;
  }

  let total = STARTING_PARTICIPATION + OUTCOME_BONUS[input.outcome];
  total += input.goals * GOAL_BONUS;
  total += input.assists * ASSIST_BONUS;
  if (input.rating >= MAN_OF_THE_MATCH_RATING) {
    total += MAN_OF_THE_MATCH_BONUS;
  }
  return total;
}
