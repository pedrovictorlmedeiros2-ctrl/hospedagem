import { describe, expect, it } from "vitest";
import { InMemoryCareerRepository } from "../../../../src/career/adapters/inMemoryCareerRepository.js";
import { playCareerMatch } from "../../../../src/career/services/playCareerMatch.js";
import { viewCareer } from "../../../../src/career/services/viewCareer.js";
import { InMemoryCompetitionRepository } from "../../../../src/competitions/adapters/inMemoryCompetitionRepository.js";
import { InMemoryMarketRepository } from "../../../../src/economy/adapters/inMemoryMarketRepository.js";
import { InMemoryWalletRepository } from "../../../../src/economy/adapters/inMemoryWalletRepository.js";
import { InMemoryMatchRepository } from "../../../../src/game/adapters/inMemoryMatchRepository.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import { EventBus } from "../../../../src/shared/eventBus.js";
import type { Logger } from "../../../../src/shared/logger.js";

function fakeLogger(): Logger {
  return { debug: () => {}, error: () => {}, warn: () => {}, info: () => {} } as unknown as Logger;
}

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    careerRepository: new InMemoryCareerRepository(),
    competitionRepository: new InMemoryCompetitionRepository(),
    matchRepository: new InMemoryMatchRepository(),
    walletRepository: new InMemoryWalletRepository(),
    marketRepository: new InMemoryMarketRepository(),
    events: new EventBus(fakeLogger()),
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

describe("viewCareer", () => {
  it("shows no season stats and no active injury before any match is played", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const view = await viewCareer(deps, { discordId: "discord-1" });

    expect(view.seasonStat).toBeNull();
    expect(view.hasActiveInjury).toBe(false);
    expect(view.career.stage).toBe("RESERVE");
  });

  it("reflects the season aggregate after a match is played", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    await playCareerMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });

    const view = await viewCareer(deps, { discordId: "discord-1" });

    expect(view.seasonStat?.matches).toBe(1);
  });
});
