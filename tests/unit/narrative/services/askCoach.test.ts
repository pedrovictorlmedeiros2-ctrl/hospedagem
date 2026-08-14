import { describe, expect, it } from "vitest";
import { InMemoryCareerRepository } from "../../../../src/career/adapters/inMemoryCareerRepository.js";
import { InMemoryCompetitionRepository } from "../../../../src/competitions/adapters/inMemoryCompetitionRepository.js";
import { InMemoryMatchRepository } from "../../../../src/game/adapters/inMemoryMatchRepository.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { TemplateNarrativeGenerator } from "../../../../src/narrative/adapters/templateNarrativeGenerator.js";
import { askCoach } from "../../../../src/narrative/services/askCoach.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    careerRepository: new InMemoryCareerRepository(),
    competitionRepository: new InMemoryCompetitionRepository(),
    matchRepository: new InMemoryMatchRepository(),
    narrativeGenerator: new TemplateNarrativeGenerator(),
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

describe("askCoach", () => {
  it("returns a message mentioning the player before any match has been played", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const { message } = await askCoach(deps, { discordId: "discord-1" });

    expect(message).toContain("Pedrinho");
    expect(message).toContain("0 partida");
  });

  it("tells an injured player to focus on recovering", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const player = await deps.playerRepository.findByUserId(user.id);
    if (!player) throw new Error("test setup failed: no player");

    const now = new Date("2026-08-14T00:00:00Z");
    await deps.careerRepository.recordInjury({
      playerId: player.id,
      severity: "MODERATE",
      diagnosis: "Lesão muscular",
      occurredAt: now,
      expectedReturnAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
    });

    const { message } = await askCoach(deps, { discordId: "discord-1", now });

    expect(message).toContain("recuperação");
  });
});
