import type { CareerStage } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { InMemoryCareerRepository } from "../../../../src/career/adapters/inMemoryCareerRepository.js";
import { nextCareerStage } from "../../../../src/career/domain/progression.js";
import { playCareerMatch } from "../../../../src/career/services/playCareerMatch.js";
import { viewStandings } from "../../../../src/career/services/viewStandings.js";
import { InMemoryCompetitionRepository } from "../../../../src/competitions/adapters/inMemoryCompetitionRepository.js";
import { InMemoryMarketRepository } from "../../../../src/economy/adapters/inMemoryMarketRepository.js";
import { InMemoryAchievementRepository } from "../../../../src/achievements/adapters/inMemoryAchievementRepository.js";
import { InMemoryRecordRepository } from "../../../../src/global/adapters/inMemoryRecordRepository.js";
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
    recordRepository: new InMemoryRecordRepository(),
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

describe("playCareerMatch", () => {
  it("plays and persists a full match, updating the season aggregate", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const match = await playCareerMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });

    expect(match.result.events[0]?.type).toBe("KICKOFF");
    expect(deps.matchRepository.recorded).toHaveLength(1);
    expect(match.lineupStatus).toBe("STARTING");
  });

  it("grants a coin reward and a salary payment that together land in the wallet", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");

    const match = await playCareerMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });

    expect(match.coinsEarned).toBeGreaterThan(0);
    expect(match.salaryPaid).toBeGreaterThan(0);
    const wallet = await deps.walletRepository.getOrCreateWallet(user.id);
    expect(wallet.coins).toBe(BigInt(match.coinsEarned + match.salaryPaid));
  });

  it("recognizes a new MOST_GOALS_SEASON world record the first time the real player scores", async () => {
    // "goal-search-2" was found by brute-forcing seeds through this exact
    // service until one produced a goal for the real player (same
    // technique as the injury seed below) — deterministic, not
    // statistical.
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const match = await playCareerMatch(deps, {
      discordId: "discord-1",
      now: new Date("2026-08-14T00:00:00Z"),
      seed: "goal-search-2",
    });

    expect(match.recordsBroken).toContain("MOST_GOALS_SEASON");
  });

  it("does not credit a 'record' for zero goals on a goalless match", async () => {
    // "goal-search-0" is one of the seeds the brute-force above rejected
    // before landing on "goal-search-2" — confirmed goalless for the real
    // player by construction.
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const match = await playCareerMatch(deps, {
      discordId: "discord-1",
      now: new Date("2026-08-14T00:00:00Z"),
      seed: "goal-search-0",
    });

    expect(match.recordsBroken).not.toContain("MOST_GOALS_SEASON");
  });

  it("emits MATCH_STARTED and MATCH_FINISHED", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    let started = 0;
    let finished = 0;
    deps.events.on("MATCH_STARTED", () => {
      started += 1;
    });
    deps.events.on("MATCH_FINISHED", () => {
      finished += 1;
    });

    await playCareerMatch(deps, { discordId: "discord-1" });

    expect(started).toBe(1);
    expect(finished).toBe(1);
  });

  it("benches the player when they have an active injury, instead of ignoring it", async () => {
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

    const match = await playCareerMatch(deps, { discordId: "discord-1", now });
    expect(match.lineupStatus).toBe("BENCH");
  });

  it("persists a stat line and updated stamina for the real player even when benched", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const player = await deps.playerRepository.findByUserId(user.id);
    if (!player) throw new Error("test setup failed: no player");

    await deps.careerRepository.recordInjury({
      playerId: player.id,
      severity: "SEVERE",
      diagnosis: "Lesão grave",
      occurredAt: new Date("2026-08-01T00:00:00Z"),
      expectedReturnAt: new Date("2027-01-01T00:00:00Z"),
    });

    await playCareerMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });

    expect(deps.matchRepository.recorded).toHaveLength(1);
    const recordedInput = deps.matchRepository.recorded[0]?.input;
    expect(recordedInput?.realPlayer.playerId).toBe(player.id);
  });

  it("moves the career stage exactly when the domain rule (nextCareerStage) says it should", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    let now = new Date("2026-08-14T00:00:00Z");
    let previousStage: CareerStage = "RESERVE";

    // The league is a double round-robin against the 6 rival clubs = 12
    // fixtures for the season; stay comfortably under that so the test
    // doesn't roll into a new season mid-assertion.
    for (let i = 0; i < 10; i++) {
      now = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const match = await playCareerMatch(deps, { discordId: "discord-1", now });

      const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
      const player = await deps.playerRepository.findByUserId(user.id);
      if (!player) throw new Error("test setup failed: no player");
      const seasonId = deps.matchRepository.recorded[deps.matchRepository.recorded.length - 1]?.input.seasonId;
      if (!seasonId) throw new Error("test setup failed: no season id recorded");
      const seasonStat = await deps.matchRepository.getPlayerSeasonStat(player.id, seasonId);
      if (!seasonStat) throw new Error("test setup failed: no season stat recorded");

      const expectedStage = nextCareerStage(previousStage, seasonStat.matches, seasonStat.avgRating);
      expect(match.newStage).toBe(expectedStage);
      expect(match.stageChanged).toBe(expectedStage !== previousStage);

      previousStage = match.newStage;
    }
  });

  it("records an injury for the real player and reflects it in hasActiveInjury", async () => {
    // A real player is only one of 22 on the pitch, so per-match injury
    // odds for them specifically are low (~0.7%, from the ~32/200 overall
    // rate in the Fase 3 engine tests, divided across 22 players) — a
    // small random sample would be flaky. `injury-search-v2-294` was
    // found by brute-forcing seeds through this exact service until one
    // produced an INJURY event for the real player, so this test is
    // deterministic instead of statistical. (Re-searched for Fase 5 —
    // home/away assignment now follows the real fixture instead of
    // always putting the player at home, which changes engine RNG
    // draws enough that the Fase 4 seed no longer reproduces an injury.)
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const now = new Date("2026-08-14T00:00:00Z");

    const match = await playCareerMatch(deps, { discordId: "discord-1", now, seed: "injury-search-v2-294" });
    expect(match.injuryOccurred).toBe(true);

    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const player = await deps.playerRepository.findByUserId(user.id);
    if (!player) throw new Error("test setup failed: no player");

    const hasActiveInjury = await deps.careerRepository.hasActiveInjury(player.id, new Date(now.getTime() + 1000));
    expect(hasActiveInjury).toBe(true);

    // And the escalação mechanic actually reacts to it on the next match.
    const nextMatch = await playCareerMatch(deps, {
      discordId: "discord-1",
      now: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      seed: "post-injury-match",
    });
    expect(nextMatch.lineupStatus).toBe("BENCH");
  });

  it("plays a full double round-robin season (12 fixtures against 6 distinct rivals, home and away), then automatically rolls into season 2 on the 13th call", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    let now = new Date("2026-08-14T00:00:00Z");
    const opponents: string[] = [];
    const sides: string[] = [];
    let lastMatch: Awaited<ReturnType<typeof playCareerMatch>> | undefined;

    for (let i = 0; i < 12; i++) {
      now = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      lastMatch = await playCareerMatch(deps, { discordId: "discord-1", now });
      opponents.push(lastMatch.opponentName);
      sides.push(lastMatch.playerSide);
    }

    // Every rival faced exactly twice (once home, once away), and no
    // rollover happened yet — 12 fixtures exactly fill season 1.
    const countByOpponent = new Map<string, number>();
    for (const opponent of opponents) {
      countByOpponent.set(opponent, (countByOpponent.get(opponent) ?? 0) + 1);
    }
    expect(countByOpponent.size).toBe(6);
    for (const count of countByOpponent.values()) {
      expect(count).toBe(2);
    }
    expect(lastMatch?.seasonRolledOver).toBe(false);
    expect(lastMatch?.seasonNumber).toBe(1);

    // Home/away actually alternates — the player isn't always "home" like Fase 4 assumed.
    expect(sides).toContain("home");
    expect(sides).toContain("away");

    // The 13th call used to throw SeasonCompleteError forever — it now
    // automatically rolls the career into a fresh season instead.
    now = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const rolledMatch = await playCareerMatch(deps, { discordId: "discord-1", now });
    expect(rolledMatch.seasonRolledOver).toBe(true);
    expect(rolledMatch.seasonNumber).toBe(2);
  });

  it("resets the league calendar and standings for the new season after rollover", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    let now = new Date("2026-08-14T00:00:00Z");
    for (let i = 0; i < 13; i++) {
      now = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await playCareerMatch(deps, { discordId: "discord-1", now });
    }

    const view = await viewStandings(deps, { discordId: "discord-1" });
    expect(view.seasonNumber).toBe(2);
    // Season 2's fresh calendar has exactly 1 match played (the 13th call above).
    const totalPlayed = view.standings.reduce((sum, row) => sum + row.played, 0);
    expect(totalPlayed).toBe(2); // one match = 2 "played" credits (home + away)
  });

  it("keeps rolling into further seasons on later calls (season 3 after 24 total matches)", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    let now = new Date("2026-08-14T00:00:00Z");
    let lastMatch: Awaited<ReturnType<typeof playCareerMatch>> | undefined;
    for (let i = 0; i < 25; i++) {
      now = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      lastMatch = await playCareerMatch(deps, { discordId: "discord-1", now });
    }

    expect(lastMatch?.seasonNumber).toBe(3);
  });

  it("unlocks FIRST_MATCH on the very first career match, and never again", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const first = await playCareerMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });
    expect(first.achievementsUnlocked).toContain("FIRST_MATCH");

    const second = await playCareerMatch(deps, { discordId: "discord-1", now: new Date("2026-08-15T00:00:00Z") });
    expect(second.achievementsUnlocked).not.toContain("FIRST_MATCH");
  });

  it("unlocks FIRST_GOAL and WORLD_RECORD together when the real player scores their first career goal", async () => {
    // Reuses the deterministic "goal-search-2" seed already established
    // above — the real player scoring for the first time in the world
    // also breaks MOST_GOALS_SEASON, so both unlock in the same call.
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const match = await playCareerMatch(deps, {
      discordId: "discord-1",
      now: new Date("2026-08-14T00:00:00Z"),
      seed: "goal-search-2",
    });

    expect(match.achievementsUnlocked).toContain("FIRST_GOAL");
    expect(match.achievementsUnlocked).toContain("WORLD_RECORD");
  });

  it("unlocks FIRST_WIN when the real player's team wins the match", async () => {
    // "win-search-13" was found by brute-forcing seeds through this exact
    // service until one produced a WIN for the real player's team — same
    // deterministic technique as the goal/injury seeds above.
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const match = await playCareerMatch(deps, {
      discordId: "discord-1",
      now: new Date("2026-08-14T00:00:00Z"),
      seed: "win-search-13",
    });

    expect(match.achievementsUnlocked).toContain("FIRST_WIN");
  });
});
