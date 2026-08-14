import { Prisma, type PrismaClient } from "@prisma/client";
import type { AchievementDefinition, AchievementKey } from "../domain/catalog.js";
import type { AchievementRepository, UnlockedAchievementRecord } from "../ports/achievementRepository.js";

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaAchievementRepository implements AchievementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureAchievement(definition: AchievementDefinition): Promise<void> {
    await this.prisma.achievement.upsert({
      where: { key: definition.key },
      create: { key: definition.key, name: definition.name, description: definition.description },
      update: {},
    });
  }

  async unlock(userId: string, key: AchievementKey, now: Date): Promise<boolean> {
    const achievement = await this.prisma.achievement.findUniqueOrThrow({ where: { key } });
    try {
      await this.prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id, unlockedAt: now },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }
      throw error;
    }
  }

  async listUnlocked(userId: string): Promise<UnlockedAchievementRecord[]> {
    const rows = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: "desc" },
    });
    return rows.map((row) => ({ key: row.achievement.key as AchievementKey, unlockedAt: row.unlockedAt }));
  }
}
