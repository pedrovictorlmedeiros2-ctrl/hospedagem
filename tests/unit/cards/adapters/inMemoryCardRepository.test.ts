import { describe, expect, it } from "vitest";
import { InMemoryCardRepository } from "../../../../src/cards/adapters/inMemoryCardRepository.js";
import { CARDS, PACKS } from "../../../../src/cards/domain/catalog.js";
import { ensureCatalog } from "../../../../src/cards/services/ensureCatalog.js";

describe("InMemoryCardRepository + ensureCatalog", () => {
  it("ensures every catalog card and pack exactly once, idempotently", async () => {
    const repo = new InMemoryCardRepository();
    await ensureCatalog(repo);
    await ensureCatalog(repo); // second call must be a no-op, not a duplicate

    const packs = await repo.listActivePacks();
    expect(packs).toHaveLength(PACKS.length);

    for (const card of CARDS) {
      expect(await repo.getCard(card.id)).toEqual(card);
    }
  });

  it("getCardsByRarity returns only cards of that rarity", async () => {
    const repo = new InMemoryCardRepository();
    await ensureCatalog(repo);

    const legendaries = await repo.getCardsByRarity("LEGENDARY");
    expect(legendaries.length).toBeGreaterThan(0);
    expect(legendaries.every((card) => card.rarity === "LEGENDARY")).toBe(true);
  });

  it("getPackOdds reflects the pinned card for pack-ouro's SPECIAL row", async () => {
    const repo = new InMemoryCardRepository();
    await ensureCatalog(repo);

    const odds = await repo.getPackOdds("pack-ouro");
    const specialRow = odds.find((o) => o.rarity === "SPECIAL");
    expect(specialRow?.pinnedCardId).toBe("card-special-01");
  });

  it("records a pack opening and reflects it in listUserCards", async () => {
    const repo = new InMemoryCardRepository();
    await ensureCatalog(repo);

    const result = await repo.recordPackOpening({
      openingId: "opening-1",
      userId: "user-1",
      packId: "pack-bronze",
      drawnCardIds: ["card-common-01", "card-common-02", "card-rare-01"],
    });

    expect(result.cards).toHaveLength(3);
    const owned = await repo.listUserCards("user-1");
    expect(owned).toHaveLength(3);
    expect(owned.map((c) => c.cardId)).toEqual(["card-common-01", "card-common-02", "card-rare-01"]);
  });

  it("is idempotent by openingId — a retried request never grants a second free set of cards", async () => {
    const repo = new InMemoryCardRepository();
    await ensureCatalog(repo);

    const first = await repo.recordPackOpening({
      openingId: "opening-retry-1",
      userId: "user-1",
      packId: "pack-bronze",
      drawnCardIds: ["card-common-01", "card-common-02", "card-rare-01"],
    });
    const second = await repo.recordPackOpening({
      openingId: "opening-retry-1",
      userId: "user-1",
      packId: "pack-bronze",
      drawnCardIds: ["card-common-01", "card-common-02", "card-rare-01"],
    });

    expect(second).toEqual(first);
    const owned = await repo.listUserCards("user-1");
    expect(owned).toHaveLength(3); // not 6
  });

  it("setFavorite toggles only the targeted user's card", async () => {
    const repo = new InMemoryCardRepository();
    await ensureCatalog(repo);
    const { cards } = await repo.recordPackOpening({
      openingId: "opening-fav",
      userId: "user-1",
      packId: "pack-bronze",
      drawnCardIds: ["card-common-01"],
    });
    const userCard = cards[0];
    if (!userCard) throw new Error("test setup failed: no card drawn");

    const updated = await repo.setFavorite(userCard.id, "user-1", true);
    expect(updated.isFavorite).toBe(true);

    await expect(repo.setFavorite(userCard.id, "user-2", true)).rejects.toThrow();
  });
});
