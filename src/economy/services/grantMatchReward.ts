import type { WalletRepository } from "../ports/walletRepository.js";
import { calculateMatchReward, type MatchRewardInput } from "../domain/matchReward.js";

export interface GrantMatchRewardDeps {
  walletRepository: WalletRepository;
}

export interface GrantMatchRewardInput extends MatchRewardInput {
  userId: string;
  /** Real Match id — the reward's idempotency key is derived from it, so re-processing the same match never pays twice. */
  matchId: string;
}

export interface GrantMatchRewardOutput {
  /** Coins actually credited BY THIS CALL — 0 when alreadyGranted is true, since no money moved. Never the computed reward at face value on a deduped call, so callers (e.g. playCareerMatch's coinsEarned) can't report a payment that didn't happen. */
  amount: number;
  balanceAfter: bigint;
  alreadyGranted: boolean;
}

export async function grantMatchReward(
  deps: GrantMatchRewardDeps,
  input: GrantMatchRewardInput,
): Promise<GrantMatchRewardOutput> {
  const computedAmount = calculateMatchReward(input);

  const { balanceAfter, alreadyApplied } = await deps.walletRepository.applyTransaction({
    userId: input.userId,
    currency: "COINS",
    type: "SOURCE",
    amount: BigInt(computedAmount),
    reason: "MATCH_REWARD",
    idempotencyKey: `match-reward:${input.matchId}`,
    metadata: {
      outcome: input.outcome,
      lineupStatus: input.lineupStatus,
      goals: input.goals,
      assists: input.assists,
      rating: input.rating,
    },
  });

  return { amount: alreadyApplied ? 0 : computedAmount, balanceAfter, alreadyGranted: alreadyApplied };
}
