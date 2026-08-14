import { describe, expect, it } from "vitest";
import { InMemoryRivalryRepository } from "../../../../src/global/adapters/inMemoryRivalryRepository.js";
import { viewRivalry } from "../../../../src/global/services/viewRivalry.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import { ProfileNotFoundError } from "../../../../src/player/domain/errors.js";
import { ValidationError } from "../../../../src/shared/errors.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    rivalryRepository: new InMemoryRivalryRepository(),
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

describe("viewRivalry", () => {
  it("starts at 0-0 for two players who've never faced each other", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Rival" }));

    const view = await viewRivalry(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" });
    expect(view.myWins).toBe(0);
    expect(view.opponentWins).toBe(0);
    expect(view.opponentNickname).toBe("Rival");
  });

  it("shows my wins from my perspective regardless of canonical player order", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Rival" }));
    const user1 = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const user2 = await deps.userRepository.ensureUserForDiscordId("discord-2");
    const player1 = await deps.playerRepository.findByUserId(user1.id);
    const player2 = await deps.playerRepository.findByUserId(user2.id);
    if (!player1 || !player2) throw new Error("test setup failed");

    await deps.rivalryRepository.recordRivalryResult(player1.id, player2.id, player1.id, new Date());

    const viewFromMe = await viewRivalry(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" });
    expect(viewFromMe.myWins).toBe(1);
    expect(viewFromMe.opponentWins).toBe(0);

    const viewFromThem = await viewRivalry(deps, { discordId: "discord-2", opponentDiscordId: "discord-1" });
    expect(viewFromThem.myWins).toBe(0);
    expect(viewFromThem.opponentWins).toBe(1);
  });

  it("rejects if I have no profile", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Rival" }));

    await expect(viewRivalry(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" })).rejects.toThrow(
      ProfileNotFoundError,
    );
  });

  it("rejects if the opponent has no profile", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));

    await expect(viewRivalry(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" })).rejects.toThrow(
      ValidationError,
    );
  });
});
