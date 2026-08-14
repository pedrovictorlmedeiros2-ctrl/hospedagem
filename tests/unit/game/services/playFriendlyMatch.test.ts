import { describe, expect, it } from "vitest";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { POSITION_LABELS } from "../../../../src/player/domain/labels.js";
import { ProfileNotFoundError } from "../../../../src/player/domain/errors.js";
import {
  createPlayerProfile,
  type CreatePlayerProfileInput,
} from "../../../../src/player/services/createPlayerProfile.js";
import { validateSquad } from "../../../../src/game/domain/validateSquad.js";
import { playFriendlyMatch } from "../../../../src/game/services/playFriendlyMatch.js";
import { EventBus } from "../../../../src/shared/eventBus.js";
import type { Logger } from "../../../../src/shared/logger.js";

const ALL_POSITIONS = Object.keys(POSITION_LABELS) as CreatePlayerProfileInput["position"][];

function fakeLogger(): Logger {
  return { debug: () => {}, error: () => {}, warn: () => {}, info: () => {} } as unknown as Logger;
}

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    events: new EventBus(fakeLogger()),
  };
}

describe("playFriendlyMatch", () => {
  it("rejects a Discord user who never created a profile", async () => {
    const deps = makeDeps();
    await expect(playFriendlyMatch(deps, { discordId: "no-profile" })).rejects.toThrow(
      ProfileNotFoundError,
    );
  });

  it("simulates a match around the caller's real player and emits MATCH_STARTED/MATCH_FINISHED", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, {
      discordId: "player-1",
      name: "Craque Teste",
      nickname: "Craque",
      nationality: "BR",
      age: 24,
      position: "ST",
      preferredFoot: "RIGHT",
      heightCm: 178,
      playStyle: "POACHER",
      shirtNumber: 9,
    });

    const started: unknown[] = [];
    const finished: unknown[] = [];
    deps.events.on("MATCH_STARTED", (payload) => {
      started.push(payload);
    });
    deps.events.on("MATCH_FINISHED", (payload) => {
      finished.push(payload);
    });

    const { result, home, away } = await playFriendlyMatch(deps, { discordId: "player-1" });

    expect(result.events[0]?.type).toBe("KICKOFF");
    expect(result.events.at(-1)?.type).toBe("FULLTIME");
    expect(home.players.some((p) => p.name === "Craque Teste")).toBe(true);
    expect(away.teamName).toBe("Seleção Amistosa");
    expect(started).toHaveLength(1);
    expect(finished).toHaveLength(1);
  });

  it("regression: builds a valid squad (exactly one GK among starters) for every possible player position", async () => {
    // findReplacementIndex previously defaulted to index 0 (the goalkeeper
    // slot) whenever the real player's position wasn't literally in the
    // synthetic 4-4-2 formation (DM/AM/LW/RW aren't) — silently fielding a
    // squad with zero goalkeepers. This exercises every position to make
    // sure that can't regress.
    for (const position of ALL_POSITIONS) {
      const deps = makeDeps();
      await createPlayerProfile(deps, {
        discordId: `player-${position}`,
        name: `Jogador ${position}`,
        nickname: position,
        nationality: "BR",
        age: 24,
        position,
        preferredFoot: "RIGHT",
        heightCm: 180,
        playStyle: "BALANCED",
        shirtNumber: null,
      });

      const { home } = await playFriendlyMatch(deps, { discordId: `player-${position}` });
      expect(
        () => validateSquad(home),
        `position ${position} should still yield a valid squad`,
      ).not.toThrow();
    }
  });
});
