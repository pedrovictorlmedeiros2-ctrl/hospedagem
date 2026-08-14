import { describe, expect, it } from "vitest";
import { InMemoryDuelRepository } from "../../../../src/multiplayer/adapters/inMemoryDuelRepository.js";
import { DuelNotPendingError } from "../../../../src/multiplayer/domain/errors.js";
import { challengeToDuel } from "../../../../src/multiplayer/services/challengeToDuel.js";
import { respondToDuel } from "../../../../src/multiplayer/services/respondToDuel.js";
import { InMemoryWalletRepository } from "../../../../src/economy/adapters/inMemoryWalletRepository.js";
import { InMemoryRecordRepository } from "../../../../src/global/adapters/inMemoryRecordRepository.js";
import { InMemoryAchievementRepository } from "../../../../src/achievements/adapters/inMemoryAchievementRepository.js";
import { InMemoryRivalryRepository } from "../../../../src/global/adapters/inMemoryRivalryRepository.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { STARTING_GLOBAL_RATING } from "../../../../src/player/domain/attributes.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import { ValidationError } from "../../../../src/shared/errors.js";
import { EventBus } from "../../../../src/shared/eventBus.js";
import type { Logger } from "../../../../src/shared/logger.js";

function fakeLogger(): Logger {
  return { debug: () => {}, error: () => {}, warn: () => {}, info: () => {} } as unknown as Logger;
}

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    duelRepository: new InMemoryDuelRepository(),
    walletRepository: new InMemoryWalletRepository(),
    recordRepository: new InMemoryRecordRepository(),
    rivalryRepository: new InMemoryRivalryRepository(),
    achievementRepository: new InMemoryAchievementRepository(),
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

async function setupChallenge(deps: ReturnType<typeof makeDeps>) {
  await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));
  await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Rival" }));
  await challengeToDuel(deps, { discordId: "discord-1", opponentDiscordId: "discord-2" });
}

describe("respondToDuel", () => {
  it("declining leaves both players' rating untouched and pays no reward", async () => {
    const deps = makeDeps();
    await setupChallenge(deps);

    const result = await respondToDuel(deps, {
      discordId: "discord-2",
      challengerDiscordId: "discord-1",
      accept: false,
    });

    expect(result.accepted).toBe(false);

    const user1 = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const player1 = await deps.playerRepository.findByUserId(user1.id);
    expect(player1?.globalRating).toBe(STARTING_GLOBAL_RATING);

    const wallet1 = await deps.walletRepository.getOrCreateWallet(user1.id);
    expect(wallet1.coins).toBe(0n);
  });

  it("accepting resolves the duel, updates both ratings oppositely, and pays both sides a reward", async () => {
    const deps = makeDeps();
    await setupChallenge(deps);

    const result = await respondToDuel(deps, {
      discordId: "discord-2",
      challengerDiscordId: "discord-1",
      accept: true,
      seed: "test-seed-1",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) throw new Error("test setup failed: expected the duel to resolve");

    expect(result.result).toBeDefined();
    expect(typeof result.challengerRatingDelta).toBe("number");
    expect(typeof result.opponentRatingDelta).toBe("number");
    if (result.outcome !== "DRAW") {
      // one side gained, the other lost
      expect(Math.sign(result.challengerRatingDelta)).not.toBe(Math.sign(result.opponentRatingDelta));
    }

    const user1 = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const user2 = await deps.userRepository.ensureUserForDiscordId("discord-2");
    const player1 = await deps.playerRepository.findByUserId(user1.id);
    const player2 = await deps.playerRepository.findByUserId(user2.id);
    expect(player1?.globalRating).toBe(STARTING_GLOBAL_RATING + result.challengerRatingDelta);
    expect(player2?.globalRating).toBe(STARTING_GLOBAL_RATING + result.opponentRatingDelta);

    const wallet1 = await deps.walletRepository.getOrCreateWallet(user1.id);
    const wallet2 = await deps.walletRepository.getOrCreateWallet(user2.id);
    expect(wallet1.coins).toBeGreaterThan(0n);
    expect(wallet2.coins).toBeGreaterThan(0n);
  });

  it("updates the rivalry head-to-head and reports the world record when one is broken", async () => {
    const deps = makeDeps();
    await setupChallenge(deps);

    const result = await respondToDuel(deps, {
      discordId: "discord-2",
      challengerDiscordId: "discord-1",
      accept: true,
      seed: "test-seed-1",
    });
    if (!result.accepted) throw new Error("test setup failed: expected the duel to resolve");

    // Both players started fresh (no prior rating record) — whichever
    // side's rating went up necessarily set a new HIGHEST_GLOBAL_RATING
    // record, since STARTING_GLOBAL_RATING was the first value ever
    // recorded for the other side too.
    expect(result.recordsBroken).toContain("HIGHEST_GLOBAL_RATING");

    expect(result.rivalryChallengerWins + result.rivalryOpponentWins).toBeLessThanOrEqual(1);
    if (result.outcome === "CHALLENGER_WIN") {
      expect(result.rivalryChallengerWins).toBe(1);
      expect(result.rivalryOpponentWins).toBe(0);
    } else if (result.outcome === "OPPONENT_WIN") {
      expect(result.rivalryChallengerWins).toBe(0);
      expect(result.rivalryOpponentWins).toBe(1);
    } else {
      expect(result.rivalryChallengerWins).toBe(0);
      expect(result.rivalryOpponentWins).toBe(0);
    }
  });

  it("unlocks DUEL_WINNER for the winning side and WORLD_RECORD for whichever side broke the rating record", async () => {
    const deps = makeDeps();
    await setupChallenge(deps);

    const result = await respondToDuel(deps, {
      discordId: "discord-2",
      challengerDiscordId: "discord-1",
      accept: true,
      seed: "test-seed-1",
    });
    if (!result.accepted) throw new Error("test setup failed: expected the duel to resolve");

    if (result.outcome === "CHALLENGER_WIN") {
      expect(result.challengerAchievementsUnlocked).toContain("DUEL_WINNER");
      expect(result.opponentAchievementsUnlocked).not.toContain("DUEL_WINNER");
    } else if (result.outcome === "OPPONENT_WIN") {
      expect(result.opponentAchievementsUnlocked).toContain("DUEL_WINNER");
      expect(result.challengerAchievementsUnlocked).not.toContain("DUEL_WINNER");
    } else {
      expect(result.challengerAchievementsUnlocked).not.toContain("DUEL_WINNER");
      expect(result.opponentAchievementsUnlocked).not.toContain("DUEL_WINNER");
    }

    // Both players started fresh, so whichever side's rating moved set a
    // new HIGHEST_GLOBAL_RATING record — same reasoning as the
    // recordsBroken assertion above, just split by side here.
    const worldRecordUnlockedSomewhere =
      result.challengerAchievementsUnlocked.includes("WORLD_RECORD") ||
      result.opponentAchievementsUnlocked.includes("WORLD_RECORD");
    expect(worldRecordUnlockedSomewhere).toBe(true);
  });

  it("rejects responding to a duel that was already resolved", async () => {
    const deps = makeDeps();
    await setupChallenge(deps);
    await respondToDuel(deps, { discordId: "discord-2", challengerDiscordId: "discord-1", accept: true, seed: "s1" });

    // No pending duel remains between them at all now.
    await expect(
      respondToDuel(deps, { discordId: "discord-2", challengerDiscordId: "discord-1", accept: true, seed: "s1" }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects responding when there is no pending duel from that challenger", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Rival" }));

    await expect(
      respondToDuel(deps, { discordId: "discord-2", challengerDiscordId: "discord-1", accept: true }),
    ).rejects.toThrow(ValidationError);
  });

  it("DuelNotPendingError is exported and thrown by the repository directly on a raw double-resolve", async () => {
    const deps = makeDeps();
    await setupChallenge(deps);
    const user1 = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const user2 = await deps.userRepository.ensureUserForDiscordId("discord-2");
    const duel = await deps.duelRepository.findPendingDuelFromChallenger(user1.id, user2.id);
    if (!duel) throw new Error("test setup failed");

    await deps.duelRepository.resolveDuel({ duelId: duel.id, winnerId: user1.id, resolvedAt: new Date() });
    await expect(
      deps.duelRepository.resolveDuel({ duelId: duel.id, winnerId: user2.id, resolvedAt: new Date() }),
    ).rejects.toThrow(DuelNotPendingError);
  });
});
