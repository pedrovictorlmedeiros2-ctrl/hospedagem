import { describe, expect, it } from "vitest";
import { InMemoryCardRepository } from "../../../../src/cards/adapters/inMemoryCardRepository.js";
import { ensureCatalog } from "../../../../src/cards/services/ensureCatalog.js";
import { toggleFavoriteCard } from "../../../../src/cards/services/toggleFavoriteCard.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { ValidationError } from "../../../../src/shared/errors.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    cardRepository: new InMemoryCardRepository(),
  };
}

describe("toggleFavoriteCard", () => {
  it("rejects a card name that doesn't exist in the catalog", async () => {
    const deps = makeDeps();
    await ensureCatalog(deps.cardRepository);

    await expect(
      toggleFavoriteCard(deps, { discordId: "discord-1", cardName: "Carta Que Não Existe" }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects favoriting a card the user doesn't own", async () => {
    const deps = makeDeps();
    await ensureCatalog(deps.cardRepository);

    await expect(toggleFavoriteCard(deps, { discordId: "discord-1", cardName: "Bruno Aljezur" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("favorites the card on the first toggle", async () => {
    const deps = makeDeps();
    await ensureCatalog(deps.cardRepository);
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    await deps.cardRepository.recordPackOpening({
      openingId: "opening-1",
      userId: user.id,
      packId: "pack-bronze",
      drawnCardIds: ["card-common-01"],
    });

    const result = await toggleFavoriteCard(deps, { discordId: "discord-1", cardName: "Bruno Aljezur" });
    expect(result.isFavorite).toBe(true);
  });

  it("unfavorites the card on the second toggle", async () => {
    const deps = makeDeps();
    await ensureCatalog(deps.cardRepository);
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    await deps.cardRepository.recordPackOpening({
      openingId: "opening-1",
      userId: user.id,
      packId: "pack-bronze",
      drawnCardIds: ["card-common-01"],
    });

    await toggleFavoriteCard(deps, { discordId: "discord-1", cardName: "Bruno Aljezur" });
    const result = await toggleFavoriteCard(deps, { discordId: "discord-1", cardName: "Bruno Aljezur" });
    expect(result.isFavorite).toBe(false);
  });

  it("only affects the calling user's own copy, never another user's", async () => {
    const deps = makeDeps();
    await ensureCatalog(deps.cardRepository);
    const userA = await deps.userRepository.ensureUserForDiscordId("discord-a");
    const userB = await deps.userRepository.ensureUserForDiscordId("discord-b");
    await deps.cardRepository.recordPackOpening({
      openingId: "opening-a",
      userId: userA.id,
      packId: "pack-bronze",
      drawnCardIds: ["card-common-01"],
    });
    await deps.cardRepository.recordPackOpening({
      openingId: "opening-b",
      userId: userB.id,
      packId: "pack-bronze",
      drawnCardIds: ["card-common-01"],
    });

    await toggleFavoriteCard(deps, { discordId: "discord-a", cardName: "Bruno Aljezur" });

    const bCards = await deps.cardRepository.listUserCards(userB.id);
    expect(bCards.every((card) => !card.isFavorite)).toBe(true);
  });
});
