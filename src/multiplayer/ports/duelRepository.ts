import type { DuelStatus, DuelTier } from "@prisma/client";

export interface DuelRecord {
  id: string;
  challengerId: string;
  opponentId: string;
  tier: DuelTier;
  status: DuelStatus;
  winnerId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface CreateDuelInput {
  challengerId: string;
  opponentId: string;
  tier: DuelTier;
}

export interface ResolveDuelInput {
  duelId: string;
  /** null means a draw. */
  winnerId: string | null;
  resolvedAt: Date;
}

/**
 * Two real Discord users challenging each other — the first port in this
 * project where both sides of an interaction are real players, not "the
 * calling user vs a shared world entity" (clubs, cards, the market).
 */
export interface DuelRepository {
  createDuel(input: CreateDuelInput): Promise<DuelRecord>;
  getDuel(duelId: string): Promise<DuelRecord | null>;
  /** Any duel between the two (either direction) that isn't in a terminal state (FINISHED/DECLINED/CANCELLED) — used to block challenge spam. */
  findOpenDuelBetween(userIdA: string, userIdB: string): Promise<DuelRecord | null>;
  /** The specific PENDING duel where `challengerId` challenged `opponentId` — used when the opponent responds. */
  findPendingDuelFromChallenger(challengerId: string, opponentId: string): Promise<DuelRecord | null>;
  /**
   * Transitions PENDING -> FINISHED. Guarded: only succeeds if the duel is
   * still PENDING at the time of the call, so a genuine retry after a
   * duel already resolved gets a clear rejection instead of resolving
   * (and paying out/re-rating) a second time. Throws if the duel isn't
   * PENDING.
   */
  resolveDuel(input: ResolveDuelInput): Promise<DuelRecord>;
  /** Transitions PENDING -> DECLINED. Same guard as resolveDuel. */
  declineDuel(duelId: string): Promise<DuelRecord>;
  /** Both sent and received, newest first. */
  listDuelsForUser(userId: string): Promise<DuelRecord[]>;
}
