import { describe, expect, it } from "vitest";
import { InMemoryRecordRepository } from "../../../../src/global/adapters/inMemoryRecordRepository.js";
import { viewRecords } from "../../../../src/global/services/viewRecords.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    recordRepository: new InMemoryRecordRepository(),
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

describe("viewRecords", () => {
  it("is empty when no record has ever been set", async () => {
    const deps = makeDeps();
    const view = await viewRecords(deps);
    expect(view.rows).toHaveLength(0);
  });

  it("resolves the current holder's nickname for each broken category", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    const player = await deps.playerRepository.findByUserId(user.id);
    if (!player) throw new Error("test setup failed: no player");

    await deps.recordRepository.setRecord({
      category: "HIGHEST_GLOBAL_RATING",
      holderPlayerId: player.id,
      value: 1600,
      previousHolderId: null,
      previousValue: null,
      achievedAt: new Date("2026-08-14T00:00:00Z"),
    });

    const view = await viewRecords(deps);

    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]?.category).toBe("HIGHEST_GLOBAL_RATING");
    expect(view.rows[0]?.holderNickname).toBe("Pedrinho");
    expect(view.rows[0]?.value).toBe(1600);
  });

  it("falls back to a placeholder nickname if the holder can't be resolved", async () => {
    const deps = makeDeps();
    await deps.recordRepository.setRecord({
      category: "MOST_GOALS_SEASON",
      holderPlayerId: "ghost-player-id",
      value: 30,
      previousHolderId: null,
      previousValue: null,
      achievedAt: new Date("2026-08-14T00:00:00Z"),
    });

    const view = await viewRecords(deps);

    expect(view.rows[0]?.holderNickname).toBe("Jogador desconhecido");
  });
});
