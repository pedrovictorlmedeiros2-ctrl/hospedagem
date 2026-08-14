import { describe, expect, it } from "vitest";
import { InMemoryRecordRepository } from "../../../../src/global/adapters/inMemoryRecordRepository.js";

describe("InMemoryRecordRepository", () => {
  it("has no current record for a category that was never set", async () => {
    const repo = new InMemoryRecordRepository();
    expect(await repo.getCurrentRecord("HIGHEST_GLOBAL_RATING")).toBeNull();
  });

  it("setRecord appends, and getCurrentRecord always returns the most recent one", async () => {
    const repo = new InMemoryRecordRepository();
    await repo.setRecord({
      category: "HIGHEST_GLOBAL_RATING",
      holderPlayerId: "p1",
      value: 1200,
      previousHolderId: null,
      previousValue: null,
      achievedAt: new Date("2026-01-01"),
    });
    const second = await repo.setRecord({
      category: "HIGHEST_GLOBAL_RATING",
      holderPlayerId: "p2",
      value: 1300,
      previousHolderId: "p1",
      previousValue: 1200,
      achievedAt: new Date("2026-02-01"),
    });

    const current = await repo.getCurrentRecord("HIGHEST_GLOBAL_RATING");
    expect(current?.id).toBe(second.id);
    expect(current?.holderPlayerId).toBe("p2");
  });

  it("keeps categories independent", async () => {
    const repo = new InMemoryRecordRepository();
    await repo.setRecord({
      category: "MOST_GOALS_SEASON",
      holderPlayerId: "p1",
      value: 5,
      previousHolderId: null,
      previousValue: null,
      achievedAt: new Date(),
    });

    expect(await repo.getCurrentRecord("HIGHEST_GLOBAL_RATING")).toBeNull();
  });

  it("listCurrentRecords returns one row per category that has ever been set", async () => {
    const repo = new InMemoryRecordRepository();
    await repo.setRecord({
      category: "MOST_GOALS_SEASON",
      holderPlayerId: "p1",
      value: 5,
      previousHolderId: null,
      previousValue: null,
      achievedAt: new Date(),
    });

    const all = await repo.listCurrentRecords();
    expect(all).toHaveLength(1);
    expect(all[0]?.category).toBe("MOST_GOALS_SEASON");
  });
});
