import { describe, expect, it } from "vitest";
import { InMemoryRecordRepository } from "../../../../src/global/adapters/inMemoryRecordRepository.js";
import { checkAndUpdateRecord } from "../../../../src/global/services/checkAndUpdateRecord.js";

describe("checkAndUpdateRecord", () => {
  it("sets a fresh record when none exists yet", async () => {
    const recordRepository = new InMemoryRecordRepository();
    const result = await checkAndUpdateRecord(
      { recordRepository },
      { category: "HIGHEST_GLOBAL_RATING", playerId: "p1", value: 1200, now: new Date() },
    );

    expect(result.isNewRecord).toBe(true);
    expect(result.record.holderPlayerId).toBe("p1");
    expect(result.record.previousHolderId).toBeNull();
  });

  it("does not update the record when the candidate value doesn't beat the current one", async () => {
    const recordRepository = new InMemoryRecordRepository();
    await checkAndUpdateRecord(
      { recordRepository },
      { category: "HIGHEST_GLOBAL_RATING", playerId: "p1", value: 1200, now: new Date() },
    );

    const result = await checkAndUpdateRecord(
      { recordRepository },
      { category: "HIGHEST_GLOBAL_RATING", playerId: "p2", value: 1100, now: new Date() },
    );

    expect(result.isNewRecord).toBe(false);
    expect(result.record.holderPlayerId).toBe("p1");
  });

  it("updates the record and remembers the previous holder when beaten", async () => {
    const recordRepository = new InMemoryRecordRepository();
    await checkAndUpdateRecord(
      { recordRepository },
      { category: "HIGHEST_GLOBAL_RATING", playerId: "p1", value: 1200, now: new Date() },
    );

    const result = await checkAndUpdateRecord(
      { recordRepository },
      { category: "HIGHEST_GLOBAL_RATING", playerId: "p2", value: 1300, now: new Date() },
    );

    expect(result.isNewRecord).toBe(true);
    expect(result.record.holderPlayerId).toBe("p2");
    expect(result.record.previousHolderId).toBe("p1");
    expect(result.record.previousValue).toBe(1200);
  });
});
