import { describe, expect, it } from "vitest";
import { InMemoryCareerRepository } from "../../../../src/career/adapters/inMemoryCareerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { listTransferOffers } from "../../../../src/economy/services/listTransferOffers.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    careerRepository: new InMemoryCareerRepository(),
  };
}

function profileInput(overrides: Partial<CreatePlayerProfileInput> = {}): CreatePlayerProfileInput {
  return {
    discordId: "discord-1",
    name: "Pedro Medeiros",
    nickname: "Pedrinho",
    nationality: "BR",
    age: 20,
    position: "ST",
    preferredFoot: "RIGHT",
    heightCm: 180,
    playStyle: "POACHER",
    shirtNumber: 9,
    ...overrides,
  };
}

describe("listTransferOffers", () => {
  it("shows the player's current (starter) club and offers from all 6 rivals for a fresh player", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const view = await listTransferOffers(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });

    expect(view.currentClubName.length).toBeGreaterThan(0);
    expect(view.offers).toHaveLength(6);
    for (const offer of view.offers) {
      expect(offer.fee).toBeGreaterThan(0);
    }
  });

  it("is deterministic for the same calendar day", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const now = new Date("2026-08-14T00:00:00Z");

    const first = await listTransferOffers(deps, { discordId: "discord-1", now });
    const second = await listTransferOffers(deps, { discordId: "discord-1", now: new Date(now.getTime() + 3600_000) });

    expect(second.offers).toEqual(first.offers);
  });
});
