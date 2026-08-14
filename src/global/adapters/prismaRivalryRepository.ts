import { Prisma, type PrismaClient } from "@prisma/client";
import { canonicalizeRivalryPair } from "../domain/rivalry.js";
import type { RivalryRecord, RivalryRepository } from "../ports/rivalryRepository.js";

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaRivalryRepository implements RivalryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateRivalry(playerIdX: string, playerIdY: string): Promise<RivalryRecord> {
    const [playerAId, playerBId] = canonicalizeRivalryPair(playerIdX, playerIdY);
    try {
      const row = await this.prisma.rivalry.upsert({
        where: { playerAId_playerBId: { playerAId, playerBId } },
        create: { playerAId, playerBId },
        update: {},
      });
      return this.toDomain(row);
    } catch (error) {
      // Same upsert race as PrismaUserRepository.ensureUserForDiscordId — see that file's comment.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const row = await this.prisma.rivalry.findUniqueOrThrow({
          where: { playerAId_playerBId: { playerAId, playerBId } },
        });
        return this.toDomain(row);
      }
      throw error;
    }
  }

  async recordRivalryResult(
    playerIdX: string,
    playerIdY: string,
    winnerId: string | null,
    matchAt: Date,
  ): Promise<RivalryRecord> {
    const [playerAId, playerBId] = canonicalizeRivalryPair(playerIdX, playerIdY);
    const aWinsDelta = winnerId === playerAId ? 1 : 0;
    const bWinsDelta = winnerId === playerBId ? 1 : 0;

    try {
      const row = await this.prisma.rivalry.upsert({
        where: { playerAId_playerBId: { playerAId, playerBId } },
        create: { playerAId, playerBId, playerAWins: aWinsDelta, playerBWins: bWinsDelta, lastMatchAt: matchAt },
        update: { playerAWins: { increment: aWinsDelta }, playerBWins: { increment: bWinsDelta }, lastMatchAt: matchAt },
      });
      return this.toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const row = await this.prisma.rivalry.update({
          where: { playerAId_playerBId: { playerAId, playerBId } },
          data: { playerAWins: { increment: aWinsDelta }, playerBWins: { increment: bWinsDelta }, lastMatchAt: matchAt },
        });
        return this.toDomain(row);
      }
      throw error;
    }
  }

  private toDomain(row: {
    id: string;
    playerAId: string;
    playerBId: string;
    playerAWins: number;
    playerBWins: number;
    lastMatchAt: Date | null;
  }): RivalryRecord {
    return {
      id: row.id,
      playerAId: row.playerAId,
      playerBId: row.playerBId,
      playerAWins: row.playerAWins,
      playerBWins: row.playerBWins,
      lastMatchAt: row.lastMatchAt,
    };
  }
}
