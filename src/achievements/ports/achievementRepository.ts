import type { AchievementDefinition, AchievementKey } from "../domain/catalog.js";

export interface UnlockedAchievementRecord {
  key: AchievementKey;
  unlockedAt: Date;
}

/**
 * `Achievement`/`UserAchievement` were modeled in the schema since Fase 0
 * but never wired up until now — no migration needed here, just the
 * ports/adapters/services layer.
 */
export interface AchievementRepository {
  /** Idempotent get-or-create by key — same shape as CardRepository.ensureCard. */
  ensureAchievement(definition: AchievementDefinition): Promise<void>;
  /**
   * Idempotent per (userId, key) — true only the call that actually
   * unlocked it for the first time, false on every call after (already
   * unlocked). The Achievement row must already exist (ensureAchievement
   * first, see services/ensureCatalog.ts).
   */
  unlock(userId: string, key: AchievementKey, now: Date): Promise<boolean>;
  /** Most recently unlocked first. */
  listUnlocked(userId: string): Promise<UnlockedAchievementRecord[]>;
}
