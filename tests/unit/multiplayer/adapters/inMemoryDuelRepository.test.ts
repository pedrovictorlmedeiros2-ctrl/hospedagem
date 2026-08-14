import { describe, expect, it } from "vitest";
import { InMemoryDuelRepository } from "../../../../src/multiplayer/adapters/inMemoryDuelRepository.js";
import { DuelNotPendingError } from "../../../../src/multiplayer/domain/errors.js";

describe("InMemoryDuelRepository", () => {
  it("creates a duel as PENDING", async () => {
    const repo = new InMemoryDuelRepository();
    const duel = await repo.createDuel({ challengerId: "user-a", opponentId: "user-b", tier: "SILVER" });
    expect(duel.status).toBe("PENDING");
    expect(duel.winnerId).toBeNull();
  });

  it("findOpenDuelBetween finds a pending duel regardless of direction", async () => {
    const repo = new InMemoryDuelRepository();
    await repo.createDuel({ challengerId: "user-a", opponentId: "user-b", tier: "SILVER" });

    expect(await repo.findOpenDuelBetween("user-a", "user-b")).not.toBeNull();
    expect(await repo.findOpenDuelBetween("user-b", "user-a")).not.toBeNull();
    expect(await repo.findOpenDuelBetween("user-a", "user-c")).toBeNull();
  });

  it("findPendingDuelFromChallenger only matches the exact direction", async () => {
    const repo = new InMemoryDuelRepository();
    await repo.createDuel({ challengerId: "user-a", opponentId: "user-b", tier: "SILVER" });

    expect(await repo.findPendingDuelFromChallenger("user-a", "user-b")).not.toBeNull();
    expect(await repo.findPendingDuelFromChallenger("user-b", "user-a")).toBeNull();
  });

  it("resolveDuel transitions PENDING to FINISHED with a winner", async () => {
    const repo = new InMemoryDuelRepository();
    const duel = await repo.createDuel({ challengerId: "user-a", opponentId: "user-b", tier: "SILVER" });

    const resolved = await repo.resolveDuel({ duelId: duel.id, winnerId: "user-a", resolvedAt: new Date() });
    expect(resolved.status).toBe("FINISHED");
    expect(resolved.winnerId).toBe("user-a");
  });

  it("resolveDuel rejects a duel that is no longer PENDING, instead of resolving it again", async () => {
    const repo = new InMemoryDuelRepository();
    const duel = await repo.createDuel({ challengerId: "user-a", opponentId: "user-b", tier: "SILVER" });
    await repo.resolveDuel({ duelId: duel.id, winnerId: "user-a", resolvedAt: new Date() });

    await expect(repo.resolveDuel({ duelId: duel.id, winnerId: "user-b", resolvedAt: new Date() })).rejects.toThrow(
      DuelNotPendingError,
    );
  });

  it("declineDuel transitions PENDING to DECLINED, and can't be resolved afterward", async () => {
    const repo = new InMemoryDuelRepository();
    const duel = await repo.createDuel({ challengerId: "user-a", opponentId: "user-b", tier: "SILVER" });

    const declined = await repo.declineDuel(duel.id);
    expect(declined.status).toBe("DECLINED");

    await expect(repo.resolveDuel({ duelId: duel.id, winnerId: "user-a", resolvedAt: new Date() })).rejects.toThrow(
      DuelNotPendingError,
    );
  });

  it("listDuelsForUser returns both sent and received duels, newest first", async () => {
    const repo = new InMemoryDuelRepository();
    const first = await repo.createDuel({ challengerId: "user-a", opponentId: "user-b", tier: "SILVER" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await repo.createDuel({ challengerId: "user-c", opponentId: "user-a", tier: "GOLD" });

    const duels = await repo.listDuelsForUser("user-a");
    expect(duels.map((d) => d.id)).toEqual([second.id, first.id]);
  });
});
