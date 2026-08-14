import { Prisma, type PrismaClient } from "@prisma/client";
import { DuelNotPendingError } from "../domain/errors.js";
import type {
  CreateDuelInput,
  DuelRecord,
  DuelRepository,
  ResolveDuelInput,
} from "../ports/duelRepository.js";

const OPEN_STATUSES = ["PENDING", "ACCEPTED", "IN_PROGRESS"] as const;

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaDuelRepository implements DuelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createDuel(input: CreateDuelInput): Promise<DuelRecord> {
    const duel = await this.prisma.duel.create({
      data: { challengerId: input.challengerId, opponentId: input.opponentId, tier: input.tier },
    });
    return this.toDomain(duel);
  }

  async getDuel(duelId: string): Promise<DuelRecord | null> {
    const duel = await this.prisma.duel.findUnique({ where: { id: duelId } });
    return duel ? this.toDomain(duel) : null;
  }

  async findOpenDuelBetween(userIdA: string, userIdB: string): Promise<DuelRecord | null> {
    const duel = await this.prisma.duel.findFirst({
      where: {
        status: { in: [...OPEN_STATUSES] },
        OR: [
          { challengerId: userIdA, opponentId: userIdB },
          { challengerId: userIdB, opponentId: userIdA },
        ],
      },
    });
    return duel ? this.toDomain(duel) : null;
  }

  async findPendingDuelFromChallenger(challengerId: string, opponentId: string): Promise<DuelRecord | null> {
    const duel = await this.prisma.duel.findFirst({
      where: { challengerId, opponentId, status: "PENDING" },
    });
    return duel ? this.toDomain(duel) : null;
  }

  async resolveDuel(input: ResolveDuelInput): Promise<DuelRecord> {
    try {
      // Guarded by status in the `where`, not just `id` — Prisma throws
      // P2025 ("record not found") if the duel isn't PENDING anymore,
      // which is exactly the signal a retry-after-already-resolved needs.
      const duel = await this.prisma.duel.update({
        where: { id: input.duelId, status: "PENDING" },
        data: { status: "FINISHED", winnerId: input.winnerId, resolvedAt: input.resolvedAt },
      });
      return this.toDomain(duel);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new DuelNotPendingError();
      }
      throw error;
    }
  }

  async declineDuel(duelId: string): Promise<DuelRecord> {
    try {
      const duel = await this.prisma.duel.update({
        where: { id: duelId, status: "PENDING" },
        data: { status: "DECLINED", resolvedAt: new Date() },
      });
      return this.toDomain(duel);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new DuelNotPendingError();
      }
      throw error;
    }
  }

  async listDuelsForUser(userId: string): Promise<DuelRecord[]> {
    const duels = await this.prisma.duel.findMany({
      where: { OR: [{ challengerId: userId }, { opponentId: userId }] },
      orderBy: { createdAt: "desc" },
    });
    return duels.map((duel) => this.toDomain(duel));
  }

  private toDomain(duel: {
    id: string;
    challengerId: string;
    opponentId: string;
    tier: DuelRecord["tier"];
    status: DuelRecord["status"];
    winnerId: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }): DuelRecord {
    return {
      id: duel.id,
      challengerId: duel.challengerId,
      opponentId: duel.opponentId,
      tier: duel.tier,
      status: duel.status,
      winnerId: duel.winnerId,
      createdAt: duel.createdAt,
      resolvedAt: duel.resolvedAt,
    };
  }
}
