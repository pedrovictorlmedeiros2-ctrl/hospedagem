import { describe, expect, it } from "vitest";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import {
  ForbiddenProfileAccessError,
  ProfileNotFoundError,
} from "../../../../src/player/domain/errors.js";
import {
  createPlayerProfile,
  type CreatePlayerProfileInput,
} from "../../../../src/player/services/createPlayerProfile.js";
import { updatePlayerProfile } from "../../../../src/player/services/updatePlayerProfile.js";
import { ValidationError } from "../../../../src/shared/errors.js";

function validCreateInput(
  overrides: Partial<CreatePlayerProfileInput> = {},
): CreatePlayerProfileInput {
  return {
    discordId: "discord-1",
    name: "Pedro Medeiros",
    nickname: "Pedrinho",
    nationality: "BR",
    age: 22,
    position: "ST",
    preferredFoot: "RIGHT",
    heightCm: 180,
    playStyle: "POACHER",
    shirtNumber: 9,
    ...overrides,
  };
}

async function makeDepsWithProfile(discordId = "discord-1") {
  const deps = {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
  };
  await createPlayerProfile(deps, validCreateInput({ discordId }));
  return deps;
}

describe("updatePlayerProfile", () => {
  it("updates identity fields", async () => {
    const deps = await makeDepsWithProfile();

    const updated = await updatePlayerProfile(deps, {
      requesterDiscordId: "discord-1",
      targetDiscordId: "discord-1",
      patch: { nickname: "Pedrão", shirtNumber: 10 },
    });

    expect(updated.nickname).toBe("Pedrão");
    expect(updated.shirtNumber).toBe(10);
    expect(updated.name).toBe("Pedro Medeiros"); // untouched field stays as-is
  });

  it("updates visual fields", async () => {
    const deps = await makeDepsWithProfile();

    const updated = await updatePlayerProfile(deps, {
      requesterDiscordId: "discord-1",
      targetDiscordId: "discord-1",
      patch: { primaryColor: "#1E90FF", theme: "midnight" },
    });

    expect(updated.primaryColor).toBe("#1E90FF");
    expect(updated.theme).toBe("midnight");
  });

  it("rejects a user trying to edit someone else's profile", async () => {
    const deps = await makeDepsWithProfile("victim");

    await expect(
      updatePlayerProfile(deps, {
        requesterDiscordId: "attacker",
        targetDiscordId: "victim",
        patch: { nickname: "Hacked" },
      }),
    ).rejects.toThrow(ForbiddenProfileAccessError);
  });

  it("rejects updating a profile that doesn't exist yet", async () => {
    const deps = {
      userRepository: new InMemoryUserRepository(),
      playerRepository: new InMemoryPlayerRepository(),
    };

    await expect(
      updatePlayerProfile(deps, {
        requesterDiscordId: "ghost",
        targetDiscordId: "ghost",
        patch: { nickname: "Fantasma" },
      }),
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it("rejects when no field is provided", async () => {
    const deps = await makeDepsWithProfile();

    await expect(
      updatePlayerProfile(deps, {
        requesterDiscordId: "discord-1",
        targetDiscordId: "discord-1",
        patch: {},
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects an invalid hex color", async () => {
    const deps = await makeDepsWithProfile();

    await expect(
      updatePlayerProfile(deps, {
        requesterDiscordId: "discord-1",
        targetDiscordId: "discord-1",
        patch: { primaryColor: "blue" },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects an invalid shirt number", async () => {
    const deps = await makeDepsWithProfile();

    await expect(
      updatePlayerProfile(deps, {
        requesterDiscordId: "discord-1",
        targetDiscordId: "discord-1",
        patch: { shirtNumber: 0 },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a theme outside the known choices", async () => {
    const deps = await makeDepsWithProfile();

    await expect(
      updatePlayerProfile(deps, {
        requesterDiscordId: "discord-1",
        targetDiscordId: "discord-1",
        patch: { theme: "rainbow-explosion" },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("leaves unrelated fields untouched after a partial update", async () => {
    const deps = await makeDepsWithProfile();
    await updatePlayerProfile(deps, {
      requesterDiscordId: "discord-1",
      targetDiscordId: "discord-1",
      patch: { theme: "gold" },
    });

    const second = await updatePlayerProfile(deps, {
      requesterDiscordId: "discord-1",
      targetDiscordId: "discord-1",
      patch: { primaryColor: "#00FF00" },
    });

    expect(second.theme).toBe("gold");
    expect(second.primaryColor).toBe("#00FF00");
  });
});
