import { describe, expect, it } from "vitest";
import { InMemoryCardRepository } from "../../../../src/cards/adapters/inMemoryCardRepository.js";
import { ensureCatalog } from "../../../../src/cards/services/ensureCatalog.js";
import { viewCollection } from "../../../../src/cards/services/viewCollection.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    cardRepository: new InMemoryCardRepository(),
  };
}

describe("viewCollection", () => {
  it("is empty for a user who never opened a pack", async () => {
    const deps = makeDeps();
    const view = await viewCollection(deps, { discordId: "discord-1" });

    expect(view.totalCards).toBe(0);
    expect(view.entries).toHaveLength(0);
  });

  it("groups duplicate cards with a count, and sorts rarest-first", async () => {
    const deps = makeDeps();
    await ensureCatalog(deps.cardRepository);
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");

    await deps.cardRepository.recordPackOpening({
      openingId: "opening-1",
      userId: user.id,
      packId: "pack-bronze",
      drawnCardIds: ["card-common-01", "card-common-01", "card-legendary-01"],
    });

    const view = await viewCollection(deps, { discordId: "discord-1" });

    expect(view.totalCards).toBe(3);
    expect(view.entries).toHaveLength(2);
    expect(view.entries[0]?.card.id).toBe("card-legendary-01"); // rarer sorts first
    expect(view.entries[0]?.count).toBe(1);
    expect(view.entries[1]?.card.id).toBe("card-common-01");
    expect(view.entries[1]?.count).toBe(2);
  });
});
