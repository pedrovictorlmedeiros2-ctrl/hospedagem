import { describe, expect, it } from "vitest";
import { InMemoryDuelRepository } from "../../../../src/multiplayer/adapters/inMemoryDuelRepository.js";
import { challengeToDuel } from "../../../../src/multiplayer/services/challengeToDuel.js";
import { listDuels } from "../../../../src/multiplayer/services/listDuels.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    duelRepository: new InMemoryDuelRepository(),
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

describe("listDuels", () => {
  it("shows a sent challenge with the correct role and counterpart", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Rival" }));
    await challengeToDuel(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" });

    const view = await listDuels(deps, { discordId: "discord-1" });
    expect(view.duels).toHaveLength(1);
    expect(view.duels[0]?.role).toBe("CHALLENGER");
    expect(view.duels[0]?.counterpartDiscordId).toBe("discord-2");
    expect(view.duels[0]?.status).toBe("PENDING");
  });

  it("shows a received challenge with the OPPONENT role", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Rival" }));
    await challengeToDuel(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" });

    const view = await listDuels(deps, { discordId: "discord-2" });
    expect(view.duels).toHaveLength(1);
    expect(view.duels[0]?.role).toBe("OPPONENT");
    expect(view.duels[0]?.counterpartDiscordId).toBe("discord-1");
  });

  it("is empty for a user with no duels", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));

    const view = await listDuels(deps, { discordId: "discord-1" });
    expect(view.duels).toHaveLength(0);
  });
});
