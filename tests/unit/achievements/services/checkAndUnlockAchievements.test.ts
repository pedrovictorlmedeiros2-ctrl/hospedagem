import { describe, expect, it } from "vitest";
import { InMemoryAchievementRepository } from "../../../../src/achievements/adapters/inMemoryAchievementRepository.js";
import { checkAndUnlockAchievements } from "../../../../src/achievements/services/checkAndUnlockAchievements.js";

describe("checkAndUnlockAchievements", () => {
  it("returns an empty array without touching the repository when there are no candidates", async () => {
    const achievementRepository = new InMemoryAchievementRepository();
    const unlocked = await checkAndUnlockAchievements({ achievementRepository }, "user-1", [], new Date());
    expect(unlocked).toEqual([]);
  });

  it("unlocks every candidate the first time and reports them", async () => {
    const achievementRepository = new InMemoryAchievementRepository();
    const unlocked = await checkAndUnlockAchievements(
      { achievementRepository },
      "user-1",
      ["FIRST_MATCH", "FIRST_GOAL"],
      new Date("2026-08-14T00:00:00Z"),
    );
    expect(unlocked).toEqual(["FIRST_MATCH", "FIRST_GOAL"]);
  });

  it("does not re-report an achievement the user already has", async () => {
    const achievementRepository = new InMemoryAchievementRepository();
    const now = new Date("2026-08-14T00:00:00Z");
    await checkAndUnlockAchievements({ achievementRepository }, "user-1", ["FIRST_MATCH"], now);

    const secondCall = await checkAndUnlockAchievements({ achievementRepository }, "user-1", ["FIRST_MATCH", "FIRST_GOAL"], now);
    expect(secondCall).toEqual(["FIRST_GOAL"]);
  });

  it("seeds the catalog automatically — callers never need to call ensureCatalog themselves", async () => {
    const achievementRepository = new InMemoryAchievementRepository();
    const unlocked = await checkAndUnlockAchievements({ achievementRepository }, "user-1", ["FIRST_PACK"], new Date());
    expect(unlocked).toEqual(["FIRST_PACK"]);
  });
});
