import { describe, expect, it } from "vitest";
import { InMemoryMarketRepository } from "../../../../src/economy/adapters/inMemoryMarketRepository.js";

describe("InMemoryMarketRepository", () => {
  it("has no active contract for a fresh player", async () => {
    const repo = new InMemoryMarketRepository();
    expect(await repo.getActiveContract("player-1")).toBeNull();
  });

  it("creates a contract as ACTIVE and returns it as the active one", async () => {
    const repo = new InMemoryMarketRepository();
    const startsAt = new Date("2026-08-14T00:00:00Z");
    const endsAt = new Date("2027-02-10T00:00:00Z");
    const created = await repo.createContract({
      playerId: "player-1",
      clubId: "club-1",
      salary: 50,
      releaseClause: 5000,
      startsAt,
      endsAt,
    });

    expect(created.status).toBe("ACTIVE");
    const active = await repo.getActiveContract("player-1");
    expect(active?.id).toBe(created.id);
  });

  it("no longer returns a terminated contract as active", async () => {
    const repo = new InMemoryMarketRepository();
    const contract = await repo.createContract({
      playerId: "player-1",
      clubId: "club-1",
      salary: 50,
      releaseClause: 5000,
      startsAt: new Date(),
      endsAt: new Date(),
    });

    await repo.terminateContract(contract.id);
    expect(await repo.getActiveContract("player-1")).toBeNull();
  });

  it("records transfers newest-first and respects the limit", async () => {
    const repo = new InMemoryMarketRepository();
    for (let i = 0; i < 3; i++) {
      await repo.recordTransfer({
        playerId: "player-1",
        fromClubId: `club-${i}`,
        toClubId: `club-${i + 1}`,
        seasonId: "season-1",
        type: "PERMANENT",
        fee: 1000,
      });
    }

    const recent = await repo.listRecentTransfers("player-1", 2);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.toClubId).toBe("club-3");
    expect(recent[1]?.toClubId).toBe("club-2");
  });

  it("keeps contracts and transfers isolated per player", async () => {
    const repo = new InMemoryMarketRepository();
    await repo.createContract({
      playerId: "player-1",
      clubId: "club-1",
      salary: 50,
      releaseClause: 5000,
      startsAt: new Date(),
      endsAt: new Date(),
    });

    expect(await repo.getActiveContract("player-2")).toBeNull();
    expect(await repo.listRecentTransfers("player-2", 10)).toHaveLength(0);
  });
});
