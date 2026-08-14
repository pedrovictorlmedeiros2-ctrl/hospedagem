import { describe, expect, it } from "vitest";
import { InMemoryCareerRepository } from "../../../../src/career/adapters/inMemoryCareerRepository.js";
import { playCareerMatch } from "../../../../src/career/services/playCareerMatch.js";
import { InMemoryCompetitionRepository } from "../../../../src/competitions/adapters/inMemoryCompetitionRepository.js";
import { InMemoryMarketRepository } from "../../../../src/economy/adapters/inMemoryMarketRepository.js";
import { InMemoryWalletRepository } from "../../../../src/economy/adapters/inMemoryWalletRepository.js";
import { TransferCooldownError } from "../../../../src/economy/domain/errors.js";
import { acceptTransferOffer } from "../../../../src/economy/services/acceptTransferOffer.js";
import { listTransferOffers } from "../../../../src/economy/services/listTransferOffers.js";
import { viewStandings } from "../../../../src/career/services/viewStandings.js";
import { InMemoryMatchRepository } from "../../../../src/game/adapters/inMemoryMatchRepository.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import { EventBus } from "../../../../src/shared/eventBus.js";
import { ValidationError } from "../../../../src/shared/errors.js";
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

describe("acceptTransferOffer", () => {
  it("moves the player to the destination club and pays a signing bonus smaller than the full fee", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const now = new Date("2026-08-14T00:00:00Z");
    const user = await deps.userRepository.ensureUserForDiscordId("discord-1");

    const { offers } = await listTransferOffers(deps, { discordId: "discord-1", now });
    const target = offers[0];
    if (!target) throw new Error("test setup failed: no offers available");

    const result = await acceptTransferOffer(deps, { discordId: "discord-1", toClubName: target.clubName, now });

    expect(result.toClubName).toBe(target.clubName);
    expect(result.fee).toBe(target.fee);
    expect(result.signingBonus).toBeLessThan(result.fee);
    expect(result.signingBonus).toBeGreaterThan(0);

    const wallet = await deps.walletRepository.getOrCreateWallet(user.id);
    expect(wallet.coins).toBe(BigInt(result.signingBonus));
  });

  it("sticks — the next career action sees the new club, not the old one", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const now = new Date("2026-08-14T00:00:00Z");

    const { offers } = await listTransferOffers(deps, { discordId: "discord-1", now });
    const target = offers[0];
    if (!target) throw new Error("test setup failed: no offers available");
    await acceptTransferOffer(deps, { discordId: "discord-1", toClubName: target.clubName, now });

    const match = await playCareerMatch(deps, { discordId: "discord-1", now: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
    expect(match.clubName).toBe(target.clubName);
  });

  it("regression: league membership after a transfer still has exactly 7 distinct clubs, not a duplicate", async () => {
    // Before this was fixed, buildLeagueTeams was called with the
    // player's CURRENT team (post-transfer, one of the 6 rivals) plus the
    // rival list itself — duplicating that team's id and crashing
    // generateRoundRobinFixtures the first time a league was generated
    // for a player who had already transferred (the league didn't exist
    // yet, so `playCareerMatch` above is what triggers generation).
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const now = new Date("2026-08-14T00:00:00Z");

    const { offers } = await listTransferOffers(deps, { discordId: "discord-1", now });
    const target = offers[0];
    if (!target) throw new Error("test setup failed: no offers available");
    await acceptTransferOffer(deps, { discordId: "discord-1", toClubName: target.clubName, now });

    await playCareerMatch(deps, { discordId: "discord-1", now: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
    const standings = await viewStandings(deps, { discordId: "discord-1" });

    expect(standings.standings).toHaveLength(7);
    expect(new Set(standings.standings.map((row) => row.teamId)).size).toBe(7);
  });

  it("rejects an unknown club name", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    await expect(
      acceptTransferOffer(deps, { discordId: "discord-1", toClubName: "Clube Que Não Existe" }),
    ).rejects.toThrow(ValidationError);
  });

  it("enforces a cooldown between transfers, closing the repeat-transfer farm", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());
    const now = new Date("2026-08-14T00:00:00Z");

    const { offers } = await listTransferOffers(deps, { discordId: "discord-1", now });
    const first = offers[0];
    if (!first) throw new Error("test setup failed: no offers available");
    await acceptTransferOffer(deps, { discordId: "discord-1", toClubName: first.clubName, now });

    const soonAfter = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { offers: offersAfter } = await listTransferOffers(deps, { discordId: "discord-1", now: soonAfter });
    const second = offersAfter[0];
    if (!second) throw new Error("test setup failed: no second offer available");

    await expect(
      acceptTransferOffer(deps, { discordId: "discord-1", toClubName: second.clubName, now: soonAfter }),
    ).rejects.toThrow(TransferCooldownError);
  });
});
