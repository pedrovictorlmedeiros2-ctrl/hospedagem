import type { CardRarity } from "@prisma/client";
import type { AchievementKey } from "../../achievements/domain/catalog.js";
import type { AchievementRepository } from "../../achievements/ports/achievementRepository.js";
import { checkAndUnlockAchievements } from "../../achievements/services/checkAndUnlockAchievements.js";
import { drawPackCards } from "../domain/packOpening.js";
import type { WalletRepository } from "../../economy/ports/walletRepository.js";
import { createRng } from "../../game/domain/rng.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import type { CardRecord, CardRepository } from "../ports/cardRepository.js";
import { ensureCatalog } from "./ensureCatalog.js";

export interface OpenPackDeps {
  userRepository: UserRepository;
  cardRepository: CardRepository;
  walletRepository: WalletRepository;
  achievementRepository: AchievementRepository;
}

export interface OpenPackInput {
  discordId: string;
  packId: string;
  /**
   * Stable id for THIS request — the Discord command passes
   * `interaction.id`, never a value generated inside this service. A
   * fresh random nonce generated here would defeat the whole point: a
   * genuine retry of the same Discord interaction (network hiccup,
   * Discord re-delivering a webhook) would get a brand new nonce each
   * attempt and could charge coins / draw cards more than once for what
   * the player experiences as a single click.
   */
  requestId: string;
}

export interface OpenPackOutput {
  packName: string;
  cards: CardRecord[];
  coinsSpent: number;
  walletBalance: bigint;
  achievementsUnlocked: AchievementKey[];
}

export async function openPack(deps: OpenPackDeps, input: OpenPackInput): Promise<OpenPackOutput> {
  await ensureCatalog(deps.cardRepository);

  const user = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const pack = await deps.cardRepository.getPack(input.packId);
  if (!pack) {
    throw new NotFoundError("CardPack", input.packId);
  }
  if (pack.priceCoins === null) {
    throw new ValidationError("Este pacote não pode ser comprado com coins.");
  }

  const idempotencyKey = `pack-open:${input.requestId}`;

  // Debited BEFORE the cards are drawn/persisted: on InsufficientFundsError
  // this throws here and nothing else in this function ever runs — no
  // wasted draw, no card granted.
  const { balanceAfter } = await deps.walletRepository.applyTransaction({
    userId: user.id,
    currency: "COINS",
    type: "SINK",
    amount: pack.priceCoins,
    reason: "PACK_PURCHASE",
    idempotencyKey,
  });

  const odds = await deps.cardRepository.getPackOdds(pack.id);
  const neededRarities = [...new Set(odds.filter((o) => !o.pinnedCardId).map((o) => o.rarity))];
  const cardsByRarity = new Map<CardRarity, string[]>();
  for (const rarity of neededRarities) {
    const cards = await deps.cardRepository.getCardsByRarity(rarity);
    cardsByRarity.set(
      rarity,
      cards.map((card) => card.id),
    );
  }

  // Seeded by the same key as the wallet debit — a retry of the same
  // request draws the exact same cards, which is what makes
  // CardRepository.recordPackOpening's openingId-based idempotency
  // actually correct instead of just "doesn't crash".
  const rng = createRng(idempotencyKey);
  const drawn = drawPackCards({ rng, cardCount: pack.cardCount, odds, cardsByRarity });

  await deps.cardRepository.recordPackOpening({
    openingId: idempotencyKey,
    userId: user.id,
    packId: pack.id,
    drawnCardIds: drawn.map((card) => card.cardId),
  });

  const cards: CardRecord[] = [];
  for (const card of drawn) {
    const details = await deps.cardRepository.getCard(card.cardId);
    if (!details) {
      throw new Error(`Internal error: drawn card ${card.cardId} not found in catalog`);
    }
    cards.push(details);
  }

  const achievementsUnlocked = await checkAndUnlockAchievements(
    { achievementRepository: deps.achievementRepository },
    user.id,
    ["FIRST_PACK"],
    new Date(),
  );

  return { packName: pack.name, cards, coinsSpent: Number(pack.priceCoins), walletBalance: balanceAfter, achievementsUnlocked };
}
