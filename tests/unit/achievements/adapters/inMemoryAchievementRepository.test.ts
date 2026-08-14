import { describe, expect, it } from "vitest";
import { InMemoryAchievementRepository } from "../../../../src/achievements/adapters/inMemoryAchievementRepository.js";
import { ACHIEVEMENTS } from "../../../../src/achievements/domain/catalog.js";

async function seedCatalog(repository: InMemoryAchievementRepository): Promise<void> {
  for (const achievement of ACHIEVEMENTS) {
    await repository.ensureAchievement(achievement);
  }
}

describe("InMemoryAchievementRepository", () => {
  it("unlocks an achievement for the first time and returns true", async () => {
    const repository = new InMemoryAchievementRepository();
    await seedCatalog(repository);

    const result = await repository.unlock("user-1", "FIRST_MATCH", new Date("2026-08-14T00:00:00Z"));
    expect(result).toBe(true);
  });

  it("is idempotent — unlocking the same achievement twice returns false the second time", async () => {
    const repository = new InMemoryAchievementRepository();
    await seedCatalog(repository);

    await repository.unlock("user-1", "FIRST_MATCH", new Date("2026-08-14T00:00:00Z"));
    const second = await repository.unlock("user-1", "FIRST_MATCH", new Date("2026-08-15T00:00:00Z"));
    expect(second).toBe(false);
  });

  it("tracks unlocks independently per user", async () => {
    const repository = new InMemoryAchievementRepository();
    await seedCatalog(repository);

    await repository.unlock("user-1", "FIRST_MATCH", new Date("2026-08-14T00:00:00Z"));
    const userB = await repository.listUnlocked("user-2");
    expect(userB).toHaveLength(0);
  });

  it("lists unlocked achievements most-recent-first", async () => {
    const repository = new InMemoryAchievementRepository();
    await seedCatalog(repository);

    await repository.unlock("user-1", "FIRST_MATCH", new Date("2026-08-14T00:00:00Z"));
    await repository.unlock("user-1", "FIRST_GOAL", new Date("2026-08-15T00:00:00Z"));

    const unlocked = await repository.listUnlocked("user-1");
    expect(unlocked.map((row) => row.key)).toEqual(["FIRST_GOAL", "FIRST_MATCH"]);
  });

  it("is empty for a user who never unlocked anything", async () => {
    const repository = new InMemoryAchievementRepository();
    const unlocked = await repository.listUnlocked("ghost-user");
    expect(unlocked).toHaveLength(0);
  });
});
