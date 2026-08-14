import { describe, expect, it } from "vitest";
import { InMemoryDuelRepository } from "../../../../src/multiplayer/adapters/inMemoryDuelRepository.js";
import { challengeToDuel } from "../../../../src/multiplayer/services/challengeToDuel.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import { ConflictError, ValidationError } from "../../../../src/shared/errors.js";
import { ProfileNotFoundError } from "../../../../src/player/domain/errors.js";

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

describe("challengeToDuel", () => {
  it("creates a PENDING duel between two players with profiles", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Rival" }));

    const { duel } = await challengeToDuel(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" });

    expect(duel.status).toBe("PENDING");
    expect(duel.tier).toBe("SILVER"); // starting rating (1000) lands here
  });

  it("rejects challenging yourself", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));

    await expect(
      challengeToDuel(deps, { discordId: "discord-1", opponentDiscordId: "discord-1" }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects if the challenger has no profile", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Rival" }));

    await expect(
      challengeToDuel(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" }),
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it("rejects if the opponent has no profile", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));

    await expect(
      challengeToDuel(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a second challenge while one is already open between the same two players", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Rival" }));
    await challengeToDuel(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" });

    await expect(
      challengeToDuel(deps, { discordId: "discord-2", opponentDiscordId: "discord-1" }),
    ).rejects.toThrow(ConflictError);
  });
});
