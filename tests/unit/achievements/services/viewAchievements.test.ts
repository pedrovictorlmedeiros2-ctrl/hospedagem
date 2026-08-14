import { describe, expect, it } from "vitest";
import { InMemoryAchievementRepository } from "../../../../src/achievements/adapters/inMemoryAchievementRepository.js";
import { ACHIEVEMENTS } from "../../../../src/achievements/domain/catalog.js";
import { checkAndUnlockAchievements } from "../../../../src/achievements/services/checkAndUnlockAchievements.js";
import { viewAchievements } from "../../../../src/achievements/services/viewAchievements.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    achievementRepository: new InMemoryAchievementRepository(),
  };
}

describe("viewAchievements", () => {
  it("shows the full catalog as locked before any unlock", async () => {
    const deps = makeDeps();
    const view = await viewAchievements(deps, { discordId: "discord-1" });

    expect(view.totalCount).toBe(ACHIEVEMENTS.length);
    expect(view.unlockedCount).toBe(0);
    expect(view.rows.every((row) => !row.unlocked && row.unlockedAt === null)).toBe(true);
  });

  it("reflects unlocked achievements with their timestamp", async () => {
    const deps = makeDeps();
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const now = new Date("2026-08-14T00:00:00Z");
    await checkAndUnlockAchievements(deps, user.id, ["FIRST_MATCH"], now);

    const view = await viewAchievements(deps, { discordId: "discord-1" });

    expect(view.unlockedCount).toBe(1);
    const row = view.rows.find((r) => r.key === "FIRST_MATCH");
    expect(row?.unlocked).toBe(true);
    expect(row?.unlockedAt).toEqual(now);
    expect(view.rows.filter((r) => r.unlocked)).toHaveLength(1);
  });

  it("never mixes up one user's unlocks with another's", async () => {
    const deps = makeDeps();
    const userA = await deps.userRepository.ensureUserForDiscordId("discord-a");
    await checkAndUnlockAchievements(deps, userA.id, ["FIRST_MATCH"], new Date());

    const view = await viewAchievements(deps, { discordId: "discord-b" });
    expect(view.unlockedCount).toBe(0);
  });
});
