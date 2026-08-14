import { describe, expect, it } from "vitest";
import { InMemoryCardRepository } from "../../../../src/cards/adapters/inMemoryCardRepository.js";
import { ensureCatalog } from "../../../../src/cards/services/ensureCatalog.js";
import { viewCardDetail } from "../../../../src/cards/services/viewCardDetail.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { ValidationError } from "../../../../src/shared/errors.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    cardRepository: new InMemoryCardRepository(),
  };
}

describe("viewCardDetail", () => {
  it("rejects a card name that doesn't exist in the catalog", async () => {
    const deps = makeDeps();
    await ensureCatalog(deps.cardRepository);

    await expect(viewCardDetail(deps, { discordId: "discord-1", cardName: "Carta Que Não Existe" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("matches the card name case-insensitively", async () => {
    const deps = makeDeps();
    await ensureCatalog(deps.cardRepository);

    const view = await viewCardDetail(deps, { discordId: "discord-1", cardName: "bruno aljezur" });
    expect(view.card.name).toBe("Bruno Aljezur");
  });

  it("shows zero copies owned and not favorited when the user never opened a pack", async () => {
    const deps = makeDeps();
    await ensureCatalog(deps.cardRepository);

    const view = await viewCardDetail(deps, { discordId: "discord-1", cardName: "Bruno Aljezur" });
    expect(view.ownedCount).toBe(0);
    expect(view.hasFavorite).toBe(false);
  });

  it("counts duplicate copies and reflects a favorited copy", async () => {
    const deps = makeDeps();
    await ensureCatalog(deps.cardRepository);
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const opening = await deps.cardRepository.recordPackOpening({
      openingId: "opening-1",
      userId: user.id,
      packId: "pack-bronze",
      drawnCardIds: ["card-common-01", "card-common-01"],
    });
    const [firstCopy] = opening.cards;
    if (!firstCopy) throw new Error("test setup failed: no card drawn");
    await deps.cardRepository.setFavorite(firstCopy.id, user.id, true);

    const view = await viewCardDetail(deps, { discordId: "discord-1", cardName: "Bruno Aljezur" });
    expect(view.ownedCount).toBe(2);
    expect(view.hasFavorite).toBe(true);
  });
});
