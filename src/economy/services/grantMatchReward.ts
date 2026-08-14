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
  amount: number;
  balanceAfter: bigint;
  alreadyGranted: boolean;
}

export async function grantMatchReward(
  deps: GrantMatchRewardDeps,
  input: GrantMatchRewardInput,
): Promise<GrantMatchRewardOutput> {
  const amount = calculateMatchReward(input);

  const { balanceAfter, alreadyApplied } = await deps.walletRepository.applyTransaction({
    userId: input.userId,
    currency: "COINS",
    type: "SOURCE",
    amount: BigInt(amount),
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

  return { amount, balanceAfter, alreadyGranted: alreadyApplied };
}
