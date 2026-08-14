import { describe, expect, it } from "vitest";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { viewRanking } from "../../../../src/global/services/viewRanking.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
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

describe("viewRanking", () => {
  it("orders players highest-first by globalRating, assigning rank 1..N", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1", nickname: "Low" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "High" }));
    const user2 = await deps.userRepository.ensureUserForDiscordId("discord-2");
    await deps.playerRepository.updateAttributes(user2.id, { globalRating: 1500 });

    const view = await viewRanking(deps, { metric: "GLOBAL_RATING" });

    expect(view.rows[0]?.nickname).toBe("High");
    expect(view.rows[0]?.rank).toBe(1);
    expect(view.rows[1]?.nickname).toBe("Low");
    expect(view.rows[1]?.rank).toBe(2);
  });

  it("respects the limit", async () => {
    const deps = makeDeps();
    for (let i = 0; i < 5; i++) {
      await createPlayerProfile(deps, profileInput({ discordId: `discord-${i}`, nickname: `P${i}` }));
    }

    const view = await viewRanking(deps, { metric: "OVERALL", limit: 2 });
    expect(view.rows).toHaveLength(2);
  });

  it("is empty when no players exist", async () => {
    const deps = makeDeps();
    const view = await viewRanking(deps, { metric: "GLOBAL_RATING" });
    expect(view.rows).toHaveLength(0);
  });
});
