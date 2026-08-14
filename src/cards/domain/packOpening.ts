import type { CardRarity } from "@prisma/client";
import { randomInt, weightedPick, type Rng } from "../../game/domain/rng.js";

export interface DrawOdds {
  rarity: CardRarity;
  weight: number;
  pinnedCardId: string | null;
}

export interface DrawnCard {
  cardId: string;
  rarity: CardRarity;
}

export interface DrawPackCardsInput {
  rng: Rng;
  cardCount: number;
  odds: DrawOdds[];
  /** Pool of card ids available for each rarity — only consulted for a rolled rarity whose odds row has no `pinnedCardId`. */
  cardsByRarity: Map<CardRarity, string[]>;
}

/**
 * The core pack-opening mechanic: roll `cardCount` independent draws
 * against the pack's rarity weights, then resolve each roll to a specific
 * card (the pinned one, or a uniform-random pick from that rarity's
 * pool). Pure and deterministic given `rng` — the calling service decides
 * how `rng` is seeded (see cards/services/openPack.ts for why that seed
 * is tied to the Discord interaction id, not a fresh random nonce).
 */
export function drawPackCards(input: DrawPackCardsInput): DrawnCard[] {
  const drawn: DrawnCard[] = [];
  for (let i = 0; i < input.cardCount; i++) {
    const rolled = weightedPick(
      input.rng,
      input.odds.map((odds) => [odds, odds.weight] as const),
    );

    if (rolled.pinnedCardId) {
      drawn.push({ cardId: rolled.pinnedCardId, rarity: rolled.rarity });
      continue;
    }

    const pool = input.cardsByRarity.get(rolled.rarity) ?? [];
    if (pool.length === 0) {
      throw new Error(`Internal error: no cards available for rarity ${rolled.rarity}`);
    }
    const cardId = pool[randomInt(input.rng, 0, pool.length - 1)];
    if (!cardId) {
      throw new Error("Internal error: card pool index out of range");
    }
    drawn.push({ cardId, rarity: rolled.rarity });
  }
  return drawn;
}
