import { InsufficientFundsError } from "../domain/errors.js";
import type {
  ApplyTransactionInput,
  ApplyTransactionResult,
  WalletRecord,
  WalletRepository,
  WalletTransactionRecord,
} from "../ports/walletRepository.js";

/** Test double mirroring PrismaWalletRepository's contract, including idempotency and insufficient-funds rejection. */
export class InMemoryWalletRepository implements WalletRepository {
  private readonly walletsByUserId = new Map<string, WalletRecord>();
  private readonly transactionsByIdempotencyKey = new Map<string, WalletTransactionRecord>();
  private readonly transactionsByWalletId = new Map<string, WalletTransactionRecord[]>();
  private nextId = 1;

  async getOrCreateWallet(userId: string): Promise<WalletRecord> {
    return { ...this.walletFor(userId) };
  }

  // No `await` occurs between the idempotency check and the balance
  // mutation below, so on Node's single-threaded event loop this method
  // body runs to completion atomically for any given `idempotencyKey` —
  // the same race-safety property the Prisma adapter gets from a real DB
  // transaction, just via the runtime's own concurrency model instead.
  async applyTransaction(input: ApplyTransactionInput): Promise<ApplyTransactionResult> {
    const existing = this.transactionsByIdempotencyKey.get(input.idempotencyKey);
    if (existing) {
      return { balanceAfter: existing.balanceAfter, alreadyApplied: true };
    }

    const wallet = this.walletFor(input.userId);
    const currentBalance = input.currency === "COINS" ? wallet.coins : wallet.tokens;
    const delta = input.type === "SOURCE" ? input.amount : -input.amount;
    const newBalance = currentBalance + delta;
    if (newBalance < 0n) {
      throw new InsufficientFundsError();
    }

    if (input.currency === "COINS") {
      wallet.coins = newBalance;
    } else {
      wallet.tokens = newBalance;
    }

    const record: WalletTransactionRecord = {
      id: `wtx-${this.nextId++}`,
      walletId: wallet.id,
      currency: input.currency,
      type: input.type,
      amount: input.amount,
      balanceAfter: newBalance,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    };
    this.transactionsByIdempotencyKey.set(input.idempotencyKey, record);
    const list = this.transactionsByWalletId.get(wallet.id) ?? [];
    list.unshift(record);
    this.transactionsByWalletId.set(wallet.id, list);

    return { balanceAfter: newBalance, alreadyApplied: false };
  }

  async listRecentTransactions(userId: string, limit: number): Promise<WalletTransactionRecord[]> {
    const wallet = this.walletsByUserId.get(userId);
    if (!wallet) return [];
    return (this.transactionsByWalletId.get(wallet.id) ?? []).slice(0, limit);
  }

  private walletFor(userId: string): WalletRecord {
    let wallet = this.walletsByUserId.get(userId);
    if (!wallet) {
      wallet = { id: `wallet-${this.nextId++}`, userId, coins: 0n, tokens: 0n };
      this.walletsByUserId.set(userId, wallet);
    }
    return wallet;
  }
}
