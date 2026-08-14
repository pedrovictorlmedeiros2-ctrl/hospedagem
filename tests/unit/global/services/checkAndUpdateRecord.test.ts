import { describe, expect, it } from "vitest";
import { InMemoryRecordRepository } from "../../../../src/global/adapters/inMemoryRecordRepository.js";
import { checkAndUpdateRecord } from "../../../../src/global/services/checkAndUpdateRecord.js";
import { EventBus } from "../../../../src/shared/eventBus.js";
import type { Logger } from "../../../../src/shared/logger.js";

function fakeLogger(): Logger {
  return { debug: () => {}, error: () => {}, warn: () => {}, info: () => {} } as unknown as Logger;
}

function makeDeps() {
  return { recordRepository: new InMemoryRecordRepository(), events: new EventBus(fakeLogger()) };
}

describe("checkAndUpdateRecord", () => {
  it("sets a fresh record when none exists yet", async () => {
    const deps = makeDeps();
    const result = await checkAndUpdateRecord(deps, {
      category: "HIGHEST_GLOBAL_RATING",
      playerId: "p1",
      value: 1200,
      now: new Date(),
    });

    expect(result.isNewRecord).toBe(true);
    expect(result.record.holderPlayerId).toBe("p1");
    expect(result.record.previousHolderId).toBeNull();
  });

  it("does not update the record when the candidate value doesn't beat the current one", async () => {
    const deps = makeDeps();
    await checkAndUpdateRecord(deps, { category: "HIGHEST_GLOBAL_RATING", playerId: "p1", value: 1200, now: new Date() });

    const result = await checkAndUpdateRecord(deps, {
      category: "HIGHEST_GLOBAL_RATING",
      playerId: "p2",
      value: 1100,
      now: new Date(),
    });

    expect(result.isNewRecord).toBe(false);
    expect(result.record.holderPlayerId).toBe("p1");
  });

  it("updates the record and remembers the previous holder when beaten", async () => {
    const deps = makeDeps();
    await checkAndUpdateRecord(deps, { category: "HIGHEST_GLOBAL_RATING", playerId: "p1", value: 1200, now: new Date() });

    const result = await checkAndUpdateRecord(deps, {
      category: "HIGHEST_GLOBAL_RATING",
      playerId: "p2",
      value: 1300,
      now: new Date(),
    });

    expect(result.isNewRecord).toBe(true);
    expect(result.record.holderPlayerId).toBe("p2");
    expect(result.record.previousHolderId).toBe("p1");
    expect(result.record.previousValue).toBe(1200);
  });

  it("emits RECORD_BROKEN with the previous holder/value when a record is actually beaten", async () => {
    const deps = makeDeps();
    await checkAndUpdateRecord(deps, { category: "HIGHEST_GLOBAL_RATING", playerId: "p1", value: 1200, now: new Date() });

    let received: unknown;
    deps.events.on("RECORD_BROKEN", (payload) => {
      received = payload;
    });
    await checkAndUpdateRecord(deps, { category: "HIGHEST_GLOBAL_RATING", playerId: "p2", value: 1300, now: new Date() });

    expect(received).toEqual({
      category: "HIGHEST_GLOBAL_RATING",
      playerId: "p2",
      previousHolderId: "p1",
      previousValue: 1200,
      value: 1300,
    });
  });

  it("does not emit RECORD_BROKEN when the candidate doesn't beat the current record", async () => {
    const deps = makeDeps();
    await checkAndUpdateRecord(deps, { category: "HIGHEST_GLOBAL_RATING", playerId: "p1", value: 1200, now: new Date() });

    let emitted = false;
    deps.events.on("RECORD_BROKEN", () => {
      emitted = true;
    });
    await checkAndUpdateRecord(deps, { category: "HIGHEST_GLOBAL_RATING", playerId: "p2", value: 1100, now: new Date() });

    expect(emitted).toBe(false);
  });
});
