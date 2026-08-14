import { ACHIEVEMENTS, type AchievementKey } from "../../achievements/domain/catalog.js";

const ACHIEVEMENT_NAME_BY_KEY = new Map(ACHIEVEMENTS.map((achievement) => [achievement.key, achievement.name]));

/** Shared celebration line, reused by every card/command that can unlock an achievement inline. */
export function achievementUnlockLines(keys: AchievementKey[]): string[] {
  return keys.map((key) => `🏅 **Conquista desbloqueada: ${ACHIEVEMENT_NAME_BY_KEY.get(key) ?? key}!** Confira /conquistas.`);
}
