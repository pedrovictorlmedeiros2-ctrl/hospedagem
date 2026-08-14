import { describe, expect, it } from "vitest";
import { InMemoryTrainingRepository } from "../../../../src/career/adapters/inMemoryTrainingRepository.js";
import { InsufficientStaminaError, TrainingCooldownError } from "../../../../src/career/domain/errors.js";
import { INTENSIVE_TRAINING_COST_COINS } from "../../../../src/career/domain/training.js";
import { trainPlayer } from "../../../../src/career/services/trainPlayer.js";
import { InMemoryWalletRepository } from "../../../../src/economy/adapters/inMemoryWalletRepository.js";
import { InsufficientFundsError } from "../../../../src/economy/domain/errors.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import { ValidationError } from "../../../../src/shared/errors.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    trainingRepository: new InMemoryTrainingRepository(),
    walletRepository: new InMemoryWalletRepository(),
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

describe("trainPlayer", () => {
  it("increases the trained attribute and overall, and costs stamina", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const before = 50; // baseline shooting for a fresh profile
    const { player, gainedPoints } = await trainPlayer(deps, { discordId: "discord-1", focus: "SHOOTING" });

    expect(player.shooting).toBe(before + gainedPoints);
    expect(gainedPoints).toBeGreaterThan(0);
    expect(player.stamina).toBeLessThan(100);
  });

  it("rejects a second session before the cooldown elapses", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const now = new Date("2026-08-14T00:00:00Z");

    await trainPlayer(deps, { discordId: "discord-1", focus: "SHOOTING", now });

    await expect(
      trainPlayer(deps, { discordId: "discord-1", focus: "PASSING", now: new Date(now.getTime() + 60 * 60 * 1000) }),
    ).rejects.toThrow(TrainingCooldownError);
  });

  it("allows a second session once the cooldown has elapsed", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const now = new Date("2026-08-14T00:00:00Z");

    await trainPlayer(deps, { discordId: "discord-1", focus: "SHOOTING", now });
    const second = await trainPlayer(deps, {
      discordId: "discord-1",
      focus: "PASSING",
      now: new Date(now.getTime() + 21 * 60 * 60 * 1000),
    });

    expect(second.player.passing).toBeGreaterThan(50);
  });

  it("rejects a focus that doesn't match the player's position", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    await expect(trainPlayer(deps, { discordId: "discord-1", focus: "GK_REFLEXES" })).rejects.toThrow(ValidationError);
  });

  it("rejects training when stamina is too low", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    await deps.playerRepository.updateAttributes(user.id, { stamina: 5 });

    await expect(trainPlayer(deps, { discordId: "discord-1", focus: "SHOOTING" })).rejects.toThrow(InsufficientStaminaError);
  });

  it("gives diminishing gains as the attribute approaches the cap", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    await deps.playerRepository.updateAttributes(user.id, { shooting: 97, stamina: 100 });

    const { gainedPoints } = await trainPlayer(deps, { discordId: "discord-1", focus: "SHOOTING" });

    expect(gainedPoints).toBe(1);
  });

  it("charges coins and doubles the gain for an intensive session", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");
    await deps.walletRepository.applyTransaction({
      userId: user.id,
      currency: "COINS",
      type: "SOURCE",
      amount: BigInt(INTENSIVE_TRAINING_COST_COINS),
      reason: "TEST_SEED",
      idempotencyKey: "test-seed-1",
    });

    const normalDeps = makeDeps();
    await createPlayerProfile(normalDeps, profileInput());
    const normal = await trainPlayer(normalDeps, { discordId: "discord-1", focus: "SHOOTING" });
    const intensive = await trainPlayer(deps, { discordId: "discord-1", focus: "SHOOTING", intensive: true });

    expect(intensive.intensive).toBe(true);
    expect(intensive.coinsSpent).toBe(INTENSIVE_TRAINING_COST_COINS);
    expect(intensive.gainedPoints).toBe(normal.gainedPoints * 2);

    const wallet = await deps.walletRepository.getOrCreateWallet(user.id);
    expect(wallet.coins).toBe(0n);
  });

  it("rejects an intensive session when the wallet can't cover the cost", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    await expect(
      trainPlayer(deps, { discordId: "discord-1", focus: "SHOOTING", intensive: true }),
    ).rejects.toThrow(InsufficientFundsError);
  });
});
