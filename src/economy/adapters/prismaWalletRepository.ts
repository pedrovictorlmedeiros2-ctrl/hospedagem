import { Prisma, type PrismaClient } from "@prisma/client";
import { InsufficientFundsError } from "../domain/errors.js";
import type {
  ApplyTransactionInput,
  ApplyTransactionResult,
  WalletRecord,
  WalletRepository,
  WalletTransactionRecord,
} from "../ports/walletRepository.js";

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaWalletRepository implements WalletRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateWallet(userId: string): Promise<WalletRecord> {
    const wallet = await this.prisma.wallet.upsert({
      where: { userId },
      create: { userId, coins: 0n, tokens: 0n },
      update: {},
    });
    return this.toDomain(wallet);
  }

  async applyTransaction(input: ApplyTransactionInput): Promise<ApplyTransactionResult> {
    try {
      const balanceAfter = await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.upsert({
          where: { userId: input.userId },
          create: { userId: input.userId, coins: 0n, tokens: 0n },
          update: {},
        });

        const delta = input.type === "SOURCE" ? input.amount : -input.amount;
        // Branched explicitly (instead of a dynamic `{ [field]: ... }` key)
        // because Prisma's generated `WalletUpdateInput` has no index
        // signature — a computed key wouldn't typecheck against it.
        const updated =
          input.currency === "COINS"
            ? await tx.wallet.update({ where: { id: wallet.id }, data: { coins: { increment: delta } } })
            : await tx.wallet.update({ where: { id: wallet.id }, data: { tokens: { increment: delta } } });
        const newBalance = input.currency === "COINS" ? updated.coins : updated.tokens;

        // Throwing here rolls back the whole interactive transaction,
        // including the increment above — the wallet is left untouched.
        if (newBalance < 0n) {
          throw new InsufficientFundsError();
        }

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            currency: input.currency,
            type: input.type,
            amount: input.amount,
            balanceAfter: newBalance,
            reason: input.reason,
            idempotencyKey: input.idempotencyKey,
            ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
          },
        });

        return newBalance;
      });

      return { balanceAfter, alreadyApplied: false };
    } catch (error) {
      // Same idempotency pattern as PrismaUserRepository.ensureUserForDiscordId:
      // a concurrent caller with the same idempotencyKey loses the unique
      // constraint race, its whole transaction (including the increment)
      // rolls back automatically, and this branch treats it as "already
      // applied" instead of a failure.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.walletTransaction.findUniqueOrThrow({
          where: { idempotencyKey: input.idempotencyKey },
        });
        return { balanceAfter: existing.balanceAfter, alreadyApplied: true };
      }
      throw error;
    }
  }

  async listRecentTransactions(userId: string, limit: number): Promise<WalletTransactionRecord[]> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return [];

    const rows = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      walletId: row.walletId,
      currency: row.currency,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      reason: row.reason,
      idempotencyKey: row.idempotencyKey,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt,
    }));
  }

  private toDomain(wallet: { id: string; userId: string; coins: bigint; tokens: bigint }): WalletRecord {
    return { id: wallet.id, userId: wallet.userId, coins: wallet.coins, tokens: wallet.tokens };
  }
}
