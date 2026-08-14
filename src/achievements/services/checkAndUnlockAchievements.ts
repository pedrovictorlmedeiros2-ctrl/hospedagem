import type { AchievementKey } from "../domain/catalog.js";
import type { AchievementRepository } from "../ports/achievementRepository.js";
import { ensureCatalog } from "./ensureCatalog.js";

export interface CheckAndUnlockAchievementsDeps {
  achievementRepository: AchievementRepository;
}

/**
 * Batch-unlocks every achievement in `candidateKeys` whose precondition
 * the CALLER already determined to be true (e.g. "this match was a win").
 * Idempotent per key — an already-unlocked achievement is silently
 * skipped, never re-announced. Returns only the ones this call actually
 * unlocked for the first time, in the order they were unlocked.
 */
export async function checkAndUnlockAchievements(
  deps: CheckAndUnlockAchievementsDeps,
  userId: string,
  candidateKeys: AchievementKey[],
  now: Date,
): Promise<AchievementKey[]> {
  if (candidateKeys.length === 0) return [];

  await ensureCatalog(deps.achievementRepository);

  const unlocked: AchievementKey[] = [];
  for (const key of candidateKeys) {
    const wasNewlyUnlocked = await deps.achievementRepository.unlock(userId, key, now);
    if (wasNewlyUnlocked) unlocked.push(key);
  }
  return unlocked;
}
