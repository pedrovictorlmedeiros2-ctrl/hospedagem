import { describe, expect, it } from "vitest";
import { InMemoryRivalryRepository } from "../../../../src/global/adapters/inMemoryRivalryRepository.js";

describe("InMemoryRivalryRepository", () => {
  it("starts a rivalry at 0-0 with no last match", async () => {
    const repo = new InMemoryRivalryRepository();
    const rivalry = await repo.getOrCreateRivalry("player-a", "player-b");
    expect(rivalry.playerAWins).toBe(0);
    expect(rivalry.playerBWins).toBe(0);
    expect(rivalry.lastMatchAt).toBeNull();
  });

  it("resolves to the same rivalry regardless of which order the pair is passed in", async () => {
    const repo = new InMemoryRivalryRepository();
    const first = await repo.getOrCreateRivalry("player-a", "player-b");
    const second = await repo.getOrCreateRivalry("player-b", "player-a");
    expect(second.id).toBe(first.id);
  });

  it("increments the winner's count and updates lastMatchAt", async () => {
    const repo = new InMemoryRivalryRepository();
    const matchAt = new Date("2026-08-14T00:00:00Z");
    const updated = await repo.recordRivalryResult("player-a", "player-b", "player-a", matchAt);

    expect(updated.playerAWins).toBe(1);
    expect(updated.playerBWins).toBe(0);
    expect(updated.lastMatchAt).toEqual(matchAt);
  });

  it("a draw updates lastMatchAt without incrementing either side", async () => {
    const repo = new InMemoryRivalryRepository();
    const matchAt = new Date("2026-08-14T00:00:00Z");
    const updated = await repo.recordRivalryResult("player-a", "player-b", null, matchAt);

    expect(updated.playerAWins).toBe(0);
    expect(updated.playerBWins).toBe(0);
    expect(updated.lastMatchAt).toEqual(matchAt);
  });

  it("accumulates wins correctly across multiple results, independent of call-order for the pair", async () => {
    const repo = new InMemoryRivalryRepository();
    await repo.recordRivalryResult("player-a", "player-b", "player-a", new Date("2026-08-01"));
    await repo.recordRivalryResult("player-b", "player-a", "player-b", new Date("2026-08-02"));
    const final = await repo.recordRivalryResult("player-a", "player-b", "player-a", new Date("2026-08-03"));

    expect(final.playerAWins).toBe(2);
    expect(final.playerBWins).toBe(1);
  });
});
