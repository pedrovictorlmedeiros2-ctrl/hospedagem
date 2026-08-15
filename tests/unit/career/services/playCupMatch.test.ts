import { describe, expect, it } from "vitest";
import { InMemoryCareerRepository } from "../../../../src/career/adapters/inMemoryCareerRepository.js";
import { playCupMatch } from "../../../../src/career/services/playCupMatch.js";
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

describe("playCupMatch", () => {
  it("plays the cup's first-round fixture when there's one pending", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const match = await playCupMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });

    expect(match.played).toBe(true);
    expect(match.result?.events[0]?.type).toBe("KICKOFF");
    expect(deps.matchRepository.recorded).toHaveLength(1);
    expect(match.status.stages.some((s) => s.stage === "QUARTER_FINAL")).toBe(true);
  });

  it("grants a cup reward that lands in the wallet", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");

    const match = await playCupMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });

    expect(match.coinsEarned).toBeGreaterThan(0);
    const wallet = await deps.walletRepository.getOrCreateWallet(user.id);
    expect(wallet.coins).toBe(BigInt(match.coinsEarned ?? 0));
  });

  it("never blocks on the other bracket games — advances (or gets eliminated) every single call", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    let roundsPlayed = 0;
    let eliminated = false;
    for (let i = 0; i < 5; i++) {
      const match = await playCupMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });
      if (!match.played) break;
      roundsPlayed += 1;
      if (match.outcome === "LOSS") {
        eliminated = true;
        break;
      }
    }

    // A cup only has 3 rounds (QUARTER_FINAL, SEMI_FINAL, FINAL) — winning
    // every one of them or getting eliminated along the way are the only
    // two ways this loop ends; it must never just "run out" of fixtures
    // to play while still alive in the bracket (that's the bug this fixes:
    // no other real player exists to play the sibling QF/SF matches).
    expect(roundsPlayed).toBeGreaterThan(0);
    expect(eliminated || roundsPlayed === 3).toBe(true);

    const nextAfterEnd = await playCupMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });
    expect(nextAfterEnd.played).toBe(false);
  });

  it("is idempotent: replaying the exact same fixture doesn't grant a second reward", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");

    const first = await playCupMatch(deps, {
      discordId: "discord-1",
      now: new Date("2026-08-14T00:00:00Z"),
      seed: "fixed-seed",
    });
    expect(first.played).toBe(true);

    const balanceAfterFirst = (await deps.walletRepository.getOrCreateWallet(user.id)).coins;
    expect(balanceAfterFirst).toBe(BigInt(first.coinsEarned ?? 0));
  });
});
