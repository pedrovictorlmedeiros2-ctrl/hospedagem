import { describe, expect, it } from "vitest";
import { InMemoryCareerRepository } from "../../../../src/career/adapters/inMemoryCareerRepository.js";
import { playCareerMatch } from "../../../../src/career/services/playCareerMatch.js";
import { viewStandings } from "../../../../src/career/services/viewStandings.js";
import { InMemoryCompetitionRepository } from "../../../../src/competitions/adapters/inMemoryCompetitionRepository.js";
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

describe("viewStandings", () => {
  it("shows all 7 clubs (the player's + 6 rivals) with zeroed rows before any match", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const view = await viewStandings(deps, { discordId: "discord-1" });

    expect(view.standings).toHaveLength(7);
    expect(view.standings.every((row) => row.played === 0)).toBe(true);
    expect(view.standings.some((row) => row.teamId === view.playerTeamId)).toBe(true);
  });

  it("every club has a distinct display name (regression: two rivals used to collide)", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const view = await viewStandings(deps, { discordId: "discord-1" });
    const names = view.standings.map((row) => row.teamName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("reflects results as the season is played", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    await playCareerMatch(deps, { discordId: "discord-1", now: new Date("2026-08-14T00:00:00Z") });
    const view = await viewStandings(deps, { discordId: "discord-1" });

    const playerRow = view.standings.find((row) => row.teamId === view.playerTeamId);
    expect(playerRow?.played).toBe(1);

    const totalPlayed = view.standings.reduce((sum, row) => sum + row.played, 0);
    expect(totalPlayed).toBe(2); // one match = 2 "played" credits (home + away)
  });

  it("agrees with playCareerMatch on which teams make up the league (same nationality -> same league)", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1", nationality: "BR" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nationality: "BR", nickname: "Segundo" }));

    const viewA = await viewStandings(deps, { discordId: "discord-1" });
    const viewB = await viewStandings(deps, { discordId: "discord-2" });

    expect(viewB.leagueName).toBe(viewA.leagueName);
    expect(viewB.standings.map((r) => r.teamId).sort()).toEqual(viewA.standings.map((r) => r.teamId).sort());
  });
});
