import { Prisma, type PrismaClient } from "@prisma/client";
import type { UserRecord, UserRepository } from "../ports/userRepository.js";

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — no
 * DATABASE_URL was available to run it end-to-end. See docs/ROADMAP.md.
 */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureUserForDiscordId(discordId: string): Promise<UserRecord> {
    try {
      const user = await this.prisma.user.upsert({
        where: { discordId },
        create: { discordId },
        update: {},
      });
      return { id: user.id, discordId: user.discordId };
    } catch (error) {
      // Prisma's `upsert` is not a single atomic SQL statement on every
      // provider — under real concurrency two upserts can both attempt the
      // `create` branch and one loses to the unique constraint on
      // discordId. That race means the row already exists, not a real
      // failure, so treat it as success and fetch the row instead of
      // propagating the conflict.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { discordId } });
        return { id: user.id, discordId: user.discordId };
      }
      throw error;
    }
  }
}
