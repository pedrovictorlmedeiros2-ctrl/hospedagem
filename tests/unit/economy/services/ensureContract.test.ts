import { describe, expect, it } from "vitest";
import { InMemoryMarketRepository } from "../../../../src/economy/adapters/inMemoryMarketRepository.js";
import { isContractExpired } from "../../../../src/economy/domain/contract.js";
import { ensureContract } from "../../../../src/economy/services/ensureContract.js";

describe("ensureContract", () => {
  it("signs a fresh contract when none exists", async () => {
    const marketRepository = new InMemoryMarketRepository();
    const now = new Date("2026-08-14T00:00:00Z");

    const contract = await ensureContract(
      { marketRepository },
      { playerId: "player-1", clubId: "club-1", playerOverall: 65, playerAge: 24, now },
    );

    expect(contract.clubId).toBe("club-1");
    expect(contract.salary).toBeGreaterThan(0);
    expect(isContractExpired(contract, now)).toBe(false);
  });

  it("returns the same contract on a second call — idempotent bootstrap", async () => {
    const marketRepository = new InMemoryMarketRepository();
    const now = new Date("2026-08-14T00:00:00Z");
    const input = { playerId: "player-1", clubId: "club-1", playerOverall: 65, playerAge: 24, now };

    const first = await ensureContract({ marketRepository }, input);
    const second = await ensureContract({ marketRepository }, input);

    expect(second.id).toBe(first.id);
  });

  it("signs a new contract when the club changed (post-transfer)", async () => {
    const marketRepository = new InMemoryMarketRepository();
    const now = new Date("2026-08-14T00:00:00Z");

    const first = await ensureContract(
      { marketRepository },
      { playerId: "player-1", clubId: "club-1", playerOverall: 65, playerAge: 24, now },
    );
    const second = await ensureContract(
      { marketRepository },
      { playerId: "player-1", clubId: "club-2", playerOverall: 65, playerAge: 24, now },
    );

    expect(second.id).not.toBe(first.id);
    expect(second.clubId).toBe("club-2");
    expect(await marketRepository.getActiveContract("player-1")).toMatchObject({ id: second.id });
  });

  it("signs a new contract when the previous one expired", async () => {
    const marketRepository = new InMemoryMarketRepository();
    const startsAt = new Date("2026-08-14T00:00:00Z");

    const first = await ensureContract(
      { marketRepository },
      { playerId: "player-1", clubId: "club-1", playerOverall: 65, playerAge: 24, now: startsAt },
    );

    const wayLater = new Date(startsAt.getTime() + 400 * 24 * 60 * 60 * 1000);
    const renewed = await ensureContract(
      { marketRepository },
      { playerId: "player-1", clubId: "club-1", playerOverall: 65, playerAge: 24, now: wayLater },
    );

    expect(renewed.id).not.toBe(first.id);
    expect(isContractExpired(renewed, wayLater)).toBe(false);
  });
});
