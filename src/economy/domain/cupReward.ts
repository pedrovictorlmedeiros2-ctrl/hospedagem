import type { StageType } from "@prisma/client";

export interface CupRewardInput {
  stage: StageType;
  outcome: "WIN" | "LOSS";
  lineupStatus: "STARTING" | "BENCH";
}

const BENCH_PARTICIPATION = 15;

/**
 * Bigger prize than a regular league round (see economy/domain/matchReward.ts)
 * the deeper the cup run goes — same "hand-tuned for a v1, not calibrated
 * against real economy data" caveat as every other reward table in this
 * codebase (see docs/RISK_REGISTER.md). A win pays double the stage's base
 * value; a loss still pays the base as a consolation for having reached
 * that round at all. Bench players get the same flat participation reward
 * used for league matches, independent of the cup's own stakes.
 */
const STAGE_BASE: Record<StageType, number> = {
  GROUP: 40,
  ROUND_OF_32: 40,
  ROUND_OF_16: 50,
  QUARTER_FINAL: 70,
  SEMI_FINAL: 110,
  FINAL: 180,
};

export function calculateCupReward(input: CupRewardInput): number {
  if (input.lineupStatus === "BENCH") {
    return BENCH_PARTICIPATION;
  }
  const base = STAGE_BASE[input.stage];
  return input.outcome === "WIN" ? base * 2 : base;
}
