import type { WalletCurrency, WalletTransactionType } from "@prisma/client";

export interface WalletRecord {
  id: string;
  userId: string;
  coins: bigint;
  tokens: bigint;
}

export interface ApplyTransactionInput {
  userId: string;
  currency: WalletCurrency;
  type: WalletTransactionType;
  /** Always positive — `type` gives the direction (SOURCE credits, SINK debits). */
  amount: bigint;
  /** Short machine-readable label, e.g. "MATCH_REWARD", "INTENSIVE_TRAINING" — shown to the user via a label map, never raw. */
  reason: string;
  /**
   * Uniquely identifies *this* logical transaction. A retry (network
   * hiccup, duplicated event, re-processed match) with the same key must
   * be a no-op that returns the original result, never a second charge —
   * this is the single mechanism the whole economy leans on to stay
   * duplication-proof, backed by `WalletTransaction.idempotencyKey`
   * being `@unique` in the schema.
   */
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface ApplyTransactionResult {
  balanceAfter: bigint;
  /** True when `idempotencyKey` had already been applied — the wallet was NOT touched again. */
  alreadyApplied: boolean;
}

export interface WalletTransactionRecord {
  id: string;
  walletId: string;
  currency: WalletCurrency;
  type: WalletTransactionType;
  amount: bigint;
  balanceAfter: bigint;
  reason: string;
  idempotencyKey: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Wallet balances are never mutated directly — every change goes through
 * `applyTransaction`, which is the only place that may touch
 * `Wallet.coins`/`Wallet.tokens`, and always alongside an append-only
 * `WalletTransaction` row. This keeps the ledger and the balance from ever
 * drifting apart, and gives every coin movement an audit trail.
 */
export interface WalletRepository {
  getOrCreateWallet(userId: string): Promise<WalletRecord>;
  /** Throws InsufficientFundsError (see economy/domain/errors.ts) if a SINK would push a balance below zero. */
  applyTransaction(input: ApplyTransactionInput): Promise<ApplyTransactionResult>;
  listRecentTransactions(userId: string, limit: number): Promise<WalletTransactionRecord[]>;
}
