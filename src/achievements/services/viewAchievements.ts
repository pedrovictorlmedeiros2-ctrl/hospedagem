import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ACHIEVEMENTS, type AchievementKey } from "../domain/catalog.js";
import type { AchievementRepository } from "../ports/achievementRepository.js";
import { ensureCatalog } from "./ensureCatalog.js";

export interface ViewAchievementsDeps {
  userRepository: UserRepository;
  achievementRepository: AchievementRepository;
}

export interface AchievementProgressRow {
  key: AchievementKey;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt: Date | null;
}

export interface ViewAchievementsOutput {
  rows: AchievementProgressRow[];
  unlockedCount: number;
  totalCount: number;
}

export async function viewAchievements(deps: ViewAchievementsDeps, input: { discordId: string }): Promise<ViewAchievementsOutput> {
  await ensureCatalog(deps.achievementRepository);

  const user = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const unlocked = await deps.achievementRepository.listUnlocked(user.id);
  const unlockedAtByKey = new Map(unlocked.map((entry) => [entry.key, entry.unlockedAt]));

  const rows: AchievementProgressRow[] = ACHIEVEMENTS.map((definition) => ({
    key: definition.key,
    name: definition.name,
    description: definition.description,
    unlocked: unlockedAtByKey.has(definition.key),
    unlockedAt: unlockedAtByKey.get(definition.key) ?? null,
  }));

  return { rows, unlockedCount: unlocked.length, totalCount: ACHIEVEMENTS.length };
}
