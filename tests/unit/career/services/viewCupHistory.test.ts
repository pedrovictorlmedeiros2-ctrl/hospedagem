import { describe, expect, it } from "vitest";
import { InMemoryCareerRepository } from "../../../../src/career/adapters/inMemoryCareerRepository.js";
import { playCupMatch } from "../../../../src/career/services/playCupMatch.js";
import { viewCupHistory } from "../../../../src/career/services/viewCupHistory.js";
import { InMemoryCupRepository } from "../../../../src/competitions/adapters/inMemoryCupRepository.js";
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
    cupRepository: new InMemoryCupRepository(),
    matchRepository: new InMemoryMatchRepository(),
    walletRepository: new InMemoryWalletRepository(),
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

describe("viewCupHistory", () => {
  it("lists no entries when the cup was never decided", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const history = await viewCupHistory(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });

    expect(history.entries).toHaveLength(0);
    expect(history.cupName).toContain("Copa");
  });

  it("includes the current season's champion once the cup is fully decided", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    let played = true;
    for (let i = 0; i < 5 && played; i++) {
      const match = await playCupMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });
      played = match.played && match.outcome !== "LOSS";
    }

    const history = await viewCupHistory(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });

    // Either the player won the whole thing (their name shows up) or got
    // eliminated along the way (someone still won it, still one entry).
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]?.seasonNumber).toBe(1);
  });
});
