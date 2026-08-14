import { describe, expect, it } from "vitest";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { DuplicateProfileError } from "../../../../src/player/domain/errors.js";
import type { NewPlayerRecord, PlayerRecord, PlayerRepository } from "../../../../src/player/ports/playerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import { ValidationError } from "../../../../src/shared/errors.js";

function validInput(overrides: Partial<CreatePlayerProfileInput> = {}): CreatePlayerProfileInput {
  return {
    discordId: "discord-1",
    name: "Pedro Medeiros",
    nickname: "Pedrinho",
    nationality: "BR",
    age: 22,
    position: "ST",
    preferredFoot: "RIGHT",
    heightCm: 180,
    playStyle: "POACHER",
    shirtNumber: 9,
    ...overrides,
  };
}

function makeDeps() {
  return { userRepository: new InMemoryUserRepository(), playerRepository: new InMemoryPlayerRepository() };
}

describe("createPlayerProfile", () => {
  it("creates a profile with a position-appropriate initial overall", async () => {
    const deps = makeDeps();

    const player = await createPlayerProfile(deps, validInput());

    expect(player.name).toBe("Pedro Medeiros");
    expect(player.nickname).toBe("Pedrinho");
    expect(player.position).toBe("ST");
    expect(player.overall).toBe(50);
    expect(player.shirtNumber).toBe(9);
  });

  it("rejects a second profile for the same Discord user (duplicate prevention)", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, validInput());

    await expect(createPlayerProfile(deps, validInput({ nickname: "Outro" }))).rejects.toThrow(DuplicateProfileError);
  });

  it("lets two different Discord users each create their own profile", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, validInput({ discordId: "discord-1" }));
    const second = await createPlayerProfile(deps, validInput({ discordId: "discord-2", nickname: "Segundo" }));

    expect(second.nickname).toBe("Segundo");
  });

  it("rejects an invalid name", async () => {
    await expect(createPlayerProfile(makeDeps(), validInput({ name: "A" }))).rejects.toThrow(ValidationError);
  });

  it("rejects an invalid nickname", async () => {
    await expect(createPlayerProfile(makeDeps(), validInput({ nickname: "!!" }))).rejects.toThrow(ValidationError);
  });

  it("rejects an invalid shirt number", async () => {
    await expect(createPlayerProfile(makeDeps(), validInput({ shirtNumber: 150 }))).rejects.toThrow(ValidationError);
  });

  it("rejects an unknown nationality", async () => {
    await expect(createPlayerProfile(makeDeps(), validInput({ nationality: "ZZ" }))).rejects.toThrow(ValidationError);
  });

  it("rejects an invalid position at the runtime boundary (simulating a malformed request)", async () => {
    // TypeScript's Position enum blocks this at compile time everywhere
    // else in the app; this simulates input that bypassed that boundary
    // (e.g. a future raw-JSON entry point) to prove the service doesn't
    // silently accept garbage — it should blow up computing initial
    // attributes rather than persist a corrupt record.
    const input = validInput({ position: "GOALKEEPER" as unknown as CreatePlayerProfileInput["position"] });
    await expect(createPlayerProfile(makeDeps(), input)).rejects.toThrow();
  });

  it("does not swallow an unexpected repository failure (e.g. database unavailable)", async () => {
    const deps = makeDeps();
    const unstableRepository: PlayerRepository = {
      findByUserId: () => Promise.resolve(null),
      create: (_input: NewPlayerRecord): Promise<PlayerRecord> =>
        Promise.reject(new Error("ECONNREFUSED: database unavailable")),
      update: (userId: string, patch) => deps.playerRepository.update(userId, patch),
    };

    await expect(
      createPlayerProfile({ ...deps, playerRepository: unstableRepository }, validInput()),
    ).rejects.toThrow(/ECONNREFUSED/);
  });

  it("resolves exactly one winner when two creations race for the same user", async () => {
    const deps = makeDeps();

    const results = await Promise.allSettled([
      createPlayerProfile(deps, validInput({ discordId: "racer" })),
      createPlayerProfile(deps, validInput({ discordId: "racer", nickname: "Rival" })),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(DuplicateProfileError);

    const stored = await deps.playerRepository.findByUserId(
      (await deps.userRepository.ensureUserForDiscordId("racer")).id,
    );
    expect(stored).not.toBeNull();
  });
});
