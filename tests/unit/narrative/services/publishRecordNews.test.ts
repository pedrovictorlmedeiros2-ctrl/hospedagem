import { describe, expect, it } from "vitest";
import { InMemoryNewsRepository } from "../../../../src/narrative/adapters/inMemoryNewsRepository.js";
import { TemplateNarrativeGenerator } from "../../../../src/narrative/adapters/templateNarrativeGenerator.js";
import { publishRecordNews } from "../../../../src/narrative/services/publishRecordNews.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import type { Logger } from "../../../../src/shared/logger.js";

function fakeLogger(): Logger {
  return { debug: () => {}, error: () => {}, warn: () => {}, info: () => {} } as unknown as Logger;
}

function makeDeps() {
  return {
    narrativeGenerator: new TemplateNarrativeGenerator(),
    newsRepository: new InMemoryNewsRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    userRepository: new InMemoryUserRepository(),
    logger: fakeLogger(),
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

describe("publishRecordNews", () => {
  it("publishes an article naming the new holder", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const player = await deps.playerRepository.findByUserId(user.id);
    if (!player) throw new Error("test setup failed: no player");

    const article = await publishRecordNews(deps, {
      category: "HIGHEST_GLOBAL_RATING",
      playerId: player.id,
      previousHolderId: null,
      previousValue: null,
      value: 1500,
      now: new Date("2026-08-14T00:00:00Z"),
    });

    const rows = await deps.newsRepository.listRecent(10);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.headline).toContain("Pedrinho");
    expect(rows[0]?.generatedByAi).toBe(false);
    expect(article).toEqual({ headline: rows[0]?.headline, body: rows[0]?.body });
  });

  it("resolves and mentions the previous holder's nickname when there was one", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput({ discordId: "discord-1", nickname: "Novo" }));
    await createPlayerProfile(deps, profileInput({ discordId: "discord-2", nickname: "Antigo" }));
    const newHolder = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const oldHolder = await deps.userRepository.ensureUserForDiscordId("discord-2");
    const newPlayer = await deps.playerRepository.findByUserId(newHolder.id);
    const oldPlayer = await deps.playerRepository.findByUserId(oldHolder.id);
    if (!newPlayer || !oldPlayer) throw new Error("test setup failed: no player");

    await publishRecordNews(deps, {
      category: "MOST_GOALS_SEASON",
      playerId: newPlayer.id,
      previousHolderId: oldPlayer.id,
      previousValue: 10,
      value: 15,
      now: new Date("2026-08-14T00:00:00Z"),
    });

    const rows = await deps.newsRepository.listRecent(10);
    expect(rows[0]?.body).toContain("Antigo");
  });

  it("skips publishing (without throwing) when the holder player can't be resolved", async () => {
    const deps = makeDeps();

    const article = await publishRecordNews(deps, {
      category: "HIGHEST_GLOBAL_RATING",
      playerId: "ghost-player-id",
      previousHolderId: null,
      previousValue: null,
      value: 1500,
      now: new Date("2026-08-14T00:00:00Z"),
    });

    const rows = await deps.newsRepository.listRecent(10);
    expect(rows).toHaveLength(0);
    expect(article).toBeNull();
  });
});
