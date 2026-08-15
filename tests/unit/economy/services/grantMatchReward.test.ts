import { describe, expect, it } from "vitest";
import { InMemoryWalletRepository } from "../../../../src/economy/adapters/inMemoryWalletRepository.js";
import { calculateMatchReward } from "../../../../src/economy/domain/matchReward.js";
import { grantMatchReward } from "../../../../src/economy/services/grantMatchReward.js";

describe("grantMatchReward", () => {
  it("credits the wallet with exactly calculateMatchReward's amount", async () => {
    const walletRepository = new InMemoryWalletRepository();
    const input = {
      userId: "user-1",
      matchId: "match-1",
      outcome: "WIN" as const,
      lineupStatus: "STARTING" as const,
      goals: 2,
      assists: 1,
      rating: 8.4,
    };

    const result = await grantMatchReward({ walletRepository }, input);

    expect(result.amount).toBe(calculateMatchReward(input));
    expect(result.balanceAfter).toBe(BigInt(result.amount));
    expect(result.alreadyGranted).toBe(false);

    const wallet = await walletRepository.getOrCreateWallet("user-1");
    expect(wallet.coins).toBe(BigInt(result.amount));
  });

  it("never pays twice for the same matchId", async () => {
    const walletRepository = new InMemoryWalletRepository();
    const input = {
      userId: "user-1",
      matchId: "match-1",
      outcome: "DRAW" as const,
      lineupStatus: "STARTING" as const,
      goals: 0,
      assists: 0,
      rating: 6,
    };

    const first = await grantMatchReward({ walletRepository }, input);
    const second = await grantMatchReward({ walletRepository }, input);

    expect(second.alreadyGranted).toBe(true);
    expect(second.balanceAfter).toBe(first.balanceAfter);

    const wallet = await walletRepository.getOrCreateWallet("user-1");
    expect(wallet.coins).toBe(BigInt(first.amount));
  });

  it("reports amount: 0 on a deduped call — never the computed reward at face value when nothing was actually paid", async () => {
    // Regression: this used to always return calculateMatchReward's value
    // regardless of alreadyGranted, so a caller (e.g. playCareerMatch's
    // coinsEarned) would report a payment that never happened on a retry.
    const walletRepository = new InMemoryWalletRepository();
    const input = {
      userId: "user-1",
      matchId: "match-1",
      outcome: "WIN" as const,
      lineupStatus: "STARTING" as const,
      goals: 1,
      assists: 0,
      rating: 7.5,
    };

    const first = await grantMatchReward({ walletRepository }, input);
    expect(first.amount).toBe(calculateMatchReward(input));
    expect(first.amount).toBeGreaterThan(0);

    const second = await grantMatchReward({ walletRepository }, input);
    expect(second.alreadyGranted).toBe(true);
    expect(second.amount).toBe(0);
  });
});
