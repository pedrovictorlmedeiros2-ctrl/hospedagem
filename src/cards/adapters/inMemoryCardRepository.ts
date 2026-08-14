import type { CardRarity } from "@prisma/client";
import type {
  CardPackRecord,
  CardRecord,
  CardRepository,
  EnsureCardInput,
  EnsurePackInput,
  PackOddsRecord,
  RecordPackOpeningInput,
  RecordPackOpeningOutput,
  UserCardRecord,
} from "../ports/cardRepository.js";

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryCardRepository implements CardRepository {
  private readonly cardsById = new Map<string, CardRecord>();
  private readonly packsById = new Map<string, CardPackRecord>();
  private readonly oddsByPackId = new Map<string, PackOddsRecord[]>();
  private readonly userCardsByUserId = new Map<string, UserCardRecord[]>();
  private readonly openingsById = new Map<string, RecordPackOpeningOutput>();
  private nextId = 1;

  async ensureCard(input: EnsureCardInput): Promise<CardRecord> {
    const existing = this.cardsById.get(input.id);
    if (existing) return existing;
    this.cardsById.set(input.id, input);
    return input;
  }

  async ensurePack(input: EnsurePackInput): Promise<CardPackRecord> {
    const { odds, ...pack } = input;
    if (!this.packsById.has(pack.id)) {
      this.packsById.set(pack.id, pack);
      this.oddsByPackId.set(
        pack.id,
        odds.map((o) => ({ rarity: o.rarity, weight: o.weight, pinnedCardId: o.pinnedCardId })),
      );
    }
    const existing = this.packsById.get(pack.id);
    if (!existing) throw new Error("Internal error: pack disappeared right after being set");
    return existing;
  }

  async listActivePacks(): Promise<CardPackRecord[]> {
    return [...this.packsById.values()];
  }

  async getPack(packId: string): Promise<CardPackRecord | null> {
    return this.packsById.get(packId) ?? null;
  }

  async getPackOdds(packId: string): Promise<PackOddsRecord[]> {
    return this.oddsByPackId.get(packId) ?? [];
  }

  async getCardsByRarity(rarity: CardRarity): Promise<CardRecord[]> {
    return [...this.cardsById.values()].filter((card) => card.rarity === rarity);
  }

  async getCard(cardId: string): Promise<CardRecord | null> {
    return this.cardsById.get(cardId) ?? null;
  }

  async listAllCards(): Promise<CardRecord[]> {
    return [...this.cardsById.values()];
  }

  async findCardByName(name: string): Promise<CardRecord | null> {
    const target = name.trim().toLowerCase();
    for (const card of this.cardsById.values()) {
      if (card.name.toLowerCase() === target) return card;
    }
    return null;
  }

  async recordPackOpening(input: RecordPackOpeningInput): Promise<RecordPackOpeningOutput> {
    const existingOpening = this.openingsById.get(input.openingId);
    if (existingOpening) return existingOpening;

    const cards: UserCardRecord[] = input.drawnCardIds.map((cardId) => ({
      id: `usercard-${this.nextId++}`,
      userId: input.userId,
      cardId,
      level: 1,
      isFavorite: false,
      acquiredAt: new Date(),
    }));

    const existing = this.userCardsByUserId.get(input.userId) ?? [];
    this.userCardsByUserId.set(input.userId, [...existing, ...cards]);

    const result: RecordPackOpeningOutput = { openingId: input.openingId, cards };
    this.openingsById.set(input.openingId, result);
    return result;
  }

  async listUserCards(userId: string): Promise<UserCardRecord[]> {
    return this.userCardsByUserId.get(userId) ?? [];
  }

  async setFavorite(userCardId: string, userId: string, isFavorite: boolean): Promise<UserCardRecord> {
    const cards = this.userCardsByUserId.get(userId) ?? [];
    const card = cards.find((c) => c.id === userCardId);
    if (!card) {
      throw new Error(`Internal error: no UserCard ${userCardId} for user ${userId}`);
    }
    card.isFavorite = isFavorite;
    return card;
  }
}
