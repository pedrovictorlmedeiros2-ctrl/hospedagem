import { ACHIEVEMENTS } from "../domain/catalog.js";
import type { AchievementRepository } from "../ports/achievementRepository.js";

/**
 * Idempotent bootstrap for the fixed achievement catalog — same shape as
 * cards/services/ensureCatalog.ts. Safe to call on every achievement-related
 * service call; a second call is a cheap no-op read for every entry.
 */
export async function ensureCatalog(achievementRepository: AchievementRepository): Promise<void> {
  for (const achievement of ACHIEVEMENTS) {
    await achievementRepository.ensureAchievement(achievement);
  }
}
