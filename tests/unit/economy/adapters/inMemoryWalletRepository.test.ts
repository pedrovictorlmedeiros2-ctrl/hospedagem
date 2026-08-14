import { describe, expect, it } from "vitest";
import { InMemoryWalletRepository } from "../../../../src/economy/adapters/inMemoryWalletRepository.js";
import { InsufficientFundsError } from "../../../../src/economy/domain/errors.js";

describe("InMemoryWalletRepository", () => {
  it("starts a new wallet at zero", async () => {
    const repo = new InMemoryWalletRepository();
    const wallet = await repo.getOrCreateWallet("user-1");
    expect(wallet.coins).toBe(0n);
    expect(wallet.tokens).toBe(0n);
  });

  it("credits a SOURCE transaction and debits a SINK transaction", async () => {
    const repo = new InMemoryWalletRepository();
    const credit = await repo.applyTransaction({
      userId: "user-1",
      currency: "COINS",
      type: "SOURCE",
      amount: 100n,
      reason: "MATCH_REWARD",
      idempotencyKey: "tx-1",
    });
    expect(credit.balanceAfter).toBe(100n);

    const debit = await repo.applyTransaction({
      userId: "user-1",
      currency: "COINS",
      type: "SINK",
      amount: 40n,
      reason: "INTENSIVE_TRAINING",
      idempotencyKey: "tx-2",
    });
    expect(debit.balanceAfter).toBe(60n);
  });

  it("rejects a SINK that would push the balance negative, and does not mutate the balance", async () => {
    const repo = new InMemoryWalletRepository();
    await repo.applyTransaction({
      userId: "user-1",
      currency: "COINS",
      type: "SOURCE",
      amount: 10n,
      reason: "MATCH_REWARD",
      idempotencyKey: "tx-1",
    });

    await expect(
      repo.applyTransaction({
        userId: "user-1",
        currency: "COINS",
        type: "SINK",
        amount: 50n,
        reason: "INTENSIVE_TRAINING",
        idempotencyKey: "tx-2",
      }),
    ).rejects.toThrow(InsufficientFundsError);

    const wallet = await repo.getOrCreateWallet("user-1");
    expect(wallet.coins).toBe(10n);
  });

  it("is idempotent: the same idempotencyKey never applies twice", async () => {
    const repo = new InMemoryWalletRepository();
    const first = await repo.applyTransaction({
      userId: "user-1",
      currency: "COINS",
      type: "SOURCE",
      amount: 100n,
      reason: "MATCH_REWARD",
      idempotencyKey: "match-reward:match-1",
    });
    const second = await repo.applyTransaction({
      userId: "user-1",
      currency: "COINS",
      type: "SOURCE",
      amount: 100n,
      reason: "MATCH_REWARD",
      idempotencyKey: "match-reward:match-1",
    });

    expect(first.alreadyApplied).toBe(false);
    expect(second.alreadyApplied).toBe(true);
    expect(second.balanceAfter).toBe(first.balanceAfter);

    const wallet = await repo.getOrCreateWallet("user-1");
    expect(wallet.coins).toBe(100n);
  });

  it("resolves a concurrent double-submit of the same idempotencyKey to a single application", async () => {
    const repo = new InMemoryWalletRepository();
    const [a, b] = await Promise.all([
      repo.applyTransaction({
        userId: "user-1",
        currency: "COINS",
        type: "SOURCE",
        amount: 100n,
        reason: "MATCH_REWARD",
        idempotencyKey: "match-reward:match-1",
      }),
      repo.applyTransaction({
        userId: "user-1",
        currency: "COINS",
        type: "SOURCE",
        amount: 100n,
        reason: "MATCH_REWARD",
        idempotencyKey: "match-reward:match-1",
      }),
    ]);

    const appliedCount = [a.alreadyApplied, b.alreadyApplied].filter((v) => v === false).length;
    expect(appliedCount).toBe(1);

    const wallet = await repo.getOrCreateWallet("user-1");
    expect(wallet.coins).toBe(100n);
  });

  it("lists recent transactions newest-first and respects the limit", async () => {
    const repo = new InMemoryWalletRepository();
    for (let i = 0; i < 3; i++) {
      await repo.applyTransaction({
        userId: "user-1",
        currency: "COINS",
        type: "SOURCE",
        amount: 10n,
        reason: "MATCH_REWARD",
        idempotencyKey: `tx-${i}`,
      });
    }

    const recent = await repo.listRecentTransactions("user-1", 2);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.idempotencyKey).toBe("tx-2");
    expect(recent[1]?.idempotencyKey).toBe("tx-1");
  });

  it("keeps separate wallets per user", async () => {
    const repo = new InMemoryWalletRepository();
    await repo.applyTransaction({
      userId: "user-1",
      currency: "COINS",
      type: "SOURCE",
      amount: 50n,
      reason: "MATCH_REWARD",
      idempotencyKey: "tx-1",
    });

    const other = await repo.getOrCreateWallet("user-2");
    expect(other.coins).toBe(0n);
  });
});
