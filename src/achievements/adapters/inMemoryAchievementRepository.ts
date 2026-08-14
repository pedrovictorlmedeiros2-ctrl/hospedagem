import type { AchievementDefinition, AchievementKey } from "../domain/catalog.js";
import type { AchievementRepository, UnlockedAchievementRecord } from "../ports/achievementRepository.js";

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryAchievementRepository implements AchievementRepository {
  private readonly catalogByKey = new Map<AchievementKey, AchievementDefinition>();
  private readonly unlockedByUserId = new Map<string, Map<AchievementKey, Date>>();

  async ensureAchievement(definition: AchievementDefinition): Promise<void> {
    if (!this.catalogByKey.has(definition.key)) {
      this.catalogByKey.set(definition.key, definition);
    }
  }

  async unlock(userId: string, key: AchievementKey, now: Date): Promise<boolean> {
    const unlocked = this.unlockedByUserId.get(userId) ?? new Map<AchievementKey, Date>();
    if (unlocked.has(key)) return false;

    unlocked.set(key, now);
    this.unlockedByUserId.set(userId, unlocked);
    return true;
  }

  async listUnlocked(userId: string): Promise<UnlockedAchievementRecord[]> {
    const unlocked = this.unlockedByUserId.get(userId) ?? new Map<AchievementKey, Date>();
    return [...unlocked.entries()]
      .map(([key, unlockedAt]) => ({ key, unlockedAt }))
      .sort((a, b) => b.unlockedAt.getTime() - a.unlockedAt.getTime());
  }
}
