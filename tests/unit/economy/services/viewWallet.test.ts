import { describe, expect, it } from "vitest";
import { InMemoryWalletRepository } from "../../../../src/economy/adapters/inMemoryWalletRepository.js";
import { viewWallet } from "../../../../src/economy/services/viewWallet.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    walletRepository: new InMemoryWalletRepository(),
  };
}

describe("viewWallet", () => {
  it("shows a zeroed wallet with no history for a brand-new user", async () => {
    const deps = makeDeps();
    const view = await viewWallet(deps, { discordId: "discord-1" });

    expect(view.coins).toBe(0n);
    expect(view.tokens).toBe(0n);
    expect(view.recentTransactions).toHaveLength(0);
  });

  it("reflects balance and history after transactions", async () => {
    const deps = makeDeps();
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    await deps.walletRepository.applyTransaction({
      userId: user.id,
      currency: "COINS",
      type: "SOURCE",
      amount: 30n,
      reason: "MATCH_REWARD",
      idempotencyKey: "tx-1",
    });

    const view = await viewWallet(deps, { discordId: "discord-1" });

    expect(view.coins).toBe(30n);
    expect(view.recentTransactions).toHaveLength(1);
    expect(view.recentTransactions[0]?.reason).toBe("MATCH_REWARD");
  });
});
