import { randomUUID } from "node:crypto";
import { DuelNotPendingError } from "../domain/errors.js";
import type {
  CreateDuelInput,
  DuelRecord,
  DuelRepository,
  ResolveDuelInput,
} from "../ports/duelRepository.js";

const OPEN_STATUSES = new Set(["PENDING", "ACCEPTED", "IN_PROGRESS"]);

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryDuelRepository implements DuelRepository {
  private readonly duelsById = new Map<string, DuelRecord>();

  async createDuel(input: CreateDuelInput): Promise<DuelRecord> {
    const duel: DuelRecord = {
      id: randomUUID(),
      challengerId: input.challengerId,
      opponentId: input.opponentId,
      tier: input.tier,
      status: "PENDING",
      winnerId: null,
      createdAt: new Date(),
      resolvedAt: null,
    };
    this.duelsById.set(duel.id, duel);
    return duel;
  }

  async getDuel(duelId: string): Promise<DuelRecord | null> {
    return this.duelsById.get(duelId) ?? null;
  }

  async findOpenDuelBetween(userIdA: string, userIdB: string): Promise<DuelRecord | null> {
    for (const duel of this.duelsById.values()) {
      const between =
        (duel.challengerId === userIdA && duel.opponentId === userIdB) ||
        (duel.challengerId === userIdB && duel.opponentId === userIdA);
      if (between && OPEN_STATUSES.has(duel.status)) {
        return duel;
      }
    }
    return null;
  }

  async findPendingDuelFromChallenger(challengerId: string, opponentId: string): Promise<DuelRecord | null> {
    for (const duel of this.duelsById.values()) {
      if (duel.challengerId === challengerId && duel.opponentId === opponentId && duel.status === "PENDING") {
        return duel;
      }
    }
    return null;
  }

  async resolveDuel(input: ResolveDuelInput): Promise<DuelRecord> {
    const duel = this.duelsById.get(input.duelId);
    if (!duel || duel.status !== "PENDING") {
      throw new DuelNotPendingError();
    }
    const updated: DuelRecord = { ...duel, status: "FINISHED", winnerId: input.winnerId, resolvedAt: input.resolvedAt };
    this.duelsById.set(duel.id, updated);
    return updated;
  }

  async declineDuel(duelId: string): Promise<DuelRecord> {
    const duel = this.duelsById.get(duelId);
    if (!duel || duel.status !== "PENDING") {
      throw new DuelNotPendingError();
    }
    const updated: DuelRecord = { ...duel, status: "DECLINED", resolvedAt: new Date() };
    this.duelsById.set(duel.id, updated);
    return updated;
  }

  async listDuelsForUser(userId: string): Promise<DuelRecord[]> {
    return [...this.duelsById.values()]
      .filter((duel) => duel.challengerId === userId || duel.opponentId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
