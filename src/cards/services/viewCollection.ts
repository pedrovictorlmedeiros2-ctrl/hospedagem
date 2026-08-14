import type { UserRepository } from "../../identity/ports/userRepository.js";
import { CARD_RARITY_ORDER } from "../domain/labels.js";
import type { CardRecord, CardRepository } from "../ports/cardRepository.js";

export interface ViewCollectionDeps {
  userRepository: UserRepository;
  cardRepository: CardRepository;
}

export interface ViewCollectionInput {
  discordId: string;
}

export interface CollectionEntry {
  card: CardRecord;
  count: number;
}

export interface ViewCollectionOutput {
  totalCards: number;
  entries: CollectionEntry[];
}

export async function viewCollection(deps: ViewCollectionDeps, input: ViewCollectionInput): Promise<ViewCollectionOutput> {
  const user = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const owned = await deps.cardRepository.listUserCards(user.id);

  const countByCardId = new Map<string, number>();
  for (const userCard of owned) {
    countByCardId.set(userCard.cardId, (countByCardId.get(userCard.cardId) ?? 0) + 1);
  }

  const entries: CollectionEntry[] = [];
  for (const [cardId, count] of countByCardId) {
    const card = await deps.cardRepository.getCard(cardId);
    if (!card) continue; // defensive: catalog entries never disappear in practice, but never crash a collection view over it
    entries.push({ card, count });
  }

  entries.sort((a, b) => {
    const rarityDiff = CARD_RARITY_ORDER.indexOf(a.card.rarity) - CARD_RARITY_ORDER.indexOf(b.card.rarity);
    if (rarityDiff !== 0) return rarityDiff;
    return b.card.overall - a.card.overall;
  });

  return { totalCards: owned.length, entries };
}
