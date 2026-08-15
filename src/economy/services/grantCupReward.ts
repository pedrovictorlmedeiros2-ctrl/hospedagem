import type { WalletRepository } from "../ports/walletRepository.js";
import { calculateCupReward, type CupRewardInput } from "../domain/cupReward.js";

export interface GrantCupRewardDeps {
  walletRepository: WalletRepository;
}

export interface GrantCupRewardInput extends CupRewardInput {
  userId: string;
  /** Real Match id — the reward's idempotency key is derived from it, so re-processing the same match never pays twice. */
  matchId: string;
}

export interface GrantCupRewardOutput {
  /** Coins actually credited BY THIS CALL — 0 when alreadyGranted is true, same convention as grantMatchReward.ts. */
  amount: number;
  balanceAfter: bigint;
  alreadyGranted: boolean;
}

export async function grantCupReward(deps: GrantCupRewardDeps, input: GrantCupRewardInput): Promise<GrantCupRewardOutput> {
  const computedAmount = calculateCupReward(input);

  const { balanceAfter, alreadyApplied } = await deps.walletRepository.applyTransaction({
    userId: input.userId,
    currency: "COINS",
    type: "SOURCE",
    amount: BigInt(computedAmount),
    reason: "CUP_REWARD",
    idempotencyKey: `cup-reward:${input.matchId}`,
    metadata: { stage: input.stage, outcome: input.outcome, lineupStatus: input.lineupStatus },
  });

  return { amount: alreadyApplied ? 0 : computedAmount, balanceAfter, alreadyGranted: alreadyApplied };
}
