import { describe, expect, it } from "vitest";
import { InMemoryCardRepository } from "../../../../src/cards/adapters/inMemoryCardRepository.js";
import { openPack } from "../../../../src/cards/services/openPack.js";
import { InMemoryWalletRepository } from "../../../../src/economy/adapters/inMemoryWalletRepository.js";
import { InsufficientFundsError } from "../../../../src/economy/domain/errors.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { NotFoundError } from "../../../../src/shared/errors.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    cardRepository: new InMemoryCardRepository(),
    walletRepository: new InMemoryWalletRepository(),
  };
}

async function grantCoins(deps: ReturnType<typeof makeDeps>, discordId: string, amount: bigint) {
  const user = await deps.userRepository.ensureUserForDiscordId(discordId);
  await deps.walletRepository.applyTransaction({
    userId: user.id,
    currency: "COINS",
    type: "SOURCE",
    amount,
    reason: "TEST_SEED",
    idempotencyKey: `seed:${discordId}`,
  });
}

describe("openPack", () => {
  it("charges the pack price and grants exactly cardCount cards", async () => {
    const deps = makeDeps();
    await grantCoins(deps, "discord-1", 1000n);

    const result = await openPack(deps, { discordId: "discord-1", packId: "pack-bronze", requestId: "req-1" });

    expect(result.coinsSpent).toBe(100);
    expect(result.cards).toHaveLength(3);
    expect(result.walletBalance).toBe(900n);
  });

  it("rejects opening a pack the wallet can't afford, without granting any card", async () => {
    const deps = makeDeps();
    await grantCoins(deps, "discord-1", 10n);

    await expect(
      openPack(deps, { discordId: "discord-1", packId: "pack-bronze", requestId: "req-1" }),
    ).rejects.toThrow(InsufficientFundsError);

    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const owned = await deps.cardRepository.listUserCards(user.id);
    expect(owned).toHaveLength(0);
  });

  it("rejects an unknown pack id", async () => {
    const deps = makeDeps();
    await grantCoins(deps, "discord-1", 1000n);

    await expect(
      openPack(deps, { discordId: "discord-1", packId: "pack-does-not-exist", requestId: "req-1" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("is idempotent by requestId: a retry never double-charges or double-grants", async () => {
    const deps = makeDeps();
    await grantCoins(deps, "discord-1", 1000n);

    const first = await openPack(deps, { discordId: "discord-1", packId: "pack-bronze", requestId: "req-retry" });
    const second = await openPack(deps, { discordId: "discord-1", packId: "pack-bronze", requestId: "req-retry" });

    expect(second.cards.map((c) => c.id)).toEqual(first.cards.map((c) => c.id));
    expect(second.walletBalance).toBe(first.walletBalance);

    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const owned = await deps.cardRepository.listUserCards(user.id);
    expect(owned).toHaveLength(3); // not 6 — the retry did not grant a second set
  });

  it("a different requestId is a genuinely new purchase (charges and draws again)", async () => {
    const deps = makeDeps();
    await grantCoins(deps, "discord-1", 1000n);

    await openPack(deps, { discordId: "discord-1", packId: "pack-bronze", requestId: "req-a" });
    const second = await openPack(deps, { discordId: "discord-1", packId: "pack-bronze", requestId: "req-b" });

    expect(second.walletBalance).toBe(800n);
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const owned = await deps.cardRepository.listUserCards(user.id);
    expect(owned).toHaveLength(6);
  });

  it("pack-ouro's SPECIAL roll always yields the pinned card when it happens to hit", async () => {
    const deps = makeDeps();
    await grantCoins(deps, "discord-1", 100000n);

    // Try enough distinct requestIds that a SPECIAL roll (5% per draw, 3 draws/pack) is overwhelmingly likely to show up at least once.
    let sawSpecial = false;
    for (let i = 0; i < 100 && !sawSpecial; i++) {
      const result = await openPack(deps, { discordId: "discord-1", packId: "pack-ouro", requestId: `req-${i}` });
      if (result.cards.some((c) => c.rarity === "SPECIAL")) {
        expect(result.cards.find((c) => c.rarity === "SPECIAL")?.id).toBe("card-special-01");
        sawSpecial = true;
      }
    }
    expect(sawSpecial).toBe(true);
  });
});
