import { describe, expect, it } from "vitest";
import { InMemoryCareerRepository } from "../../../../src/career/adapters/inMemoryCareerRepository.js";
import { ensureCareerStarted } from "../../../../src/career/services/ensureCareerStarted.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { ProfileNotFoundError } from "../../../../src/player/domain/errors.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";

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

describe("ensureCareerStarted", () => {
  it("rejects a Discord user who never created a profile", async () => {
    const deps = makeDeps();
    await expect(ensureCareerStarted(deps, "ghost")).rejects.toThrow(ProfileNotFoundError);
  });

  it("creates a career, club and team the first time", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const world = await ensureCareerStarted(deps, "discord-1");

    expect(world.career.stage).toBe("RESERVE");
    expect(world.career.currentClubId).toBe(world.club.id);
    expect(world.team.clubId).toBe(world.club.id);
    expect(world.team.seasonId).toBe(world.season.id);
  });

  it("is idempotent — a second call returns the same career/club/team", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const first = await ensureCareerStarted(deps, "discord-1");
    const second = await ensureCareerStarted(deps, "discord-1");

    expect(second.career.id).toBe(first.career.id);
    expect(second.club.id).toBe(first.club.id);
    expect(second.team.id).toBe(first.team.id);
  });

  it("puts two players of the same nationality at the same shared starter club", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1", nationality: "BR" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nationality: "BR", nickname: "Segundo" }));

    const worldA = await ensureCareerStarted(deps, "discord-1");
    const worldB = await ensureCareerStarted(deps, "discord-2");

    expect(worldB.club.id).toBe(worldA.club.id);
    expect(worldB.team.id).toBe(worldA.team.id);
  });

  it("gives players of different nationalities different starter clubs", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1", nationality: "BR" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nationality: "AR", nickname: "Segundo" }));

    const worldA = await ensureCareerStarted(deps, "discord-1");
    const worldB = await ensureCareerStarted(deps, "discord-2");

    expect(worldB.club.id).not.toBe(worldA.club.id);
  });
});
