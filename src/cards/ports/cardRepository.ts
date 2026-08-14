import type { CardRarity, Position } from "@prisma/client";

export interface CardRecord {
  id: string;
  name: string;
  position: Position;
  overall: number;
  attributes: Record<string, number>;
  rarity: CardRarity;
  ability: string | null;
}

export type EnsureCardInput = CardRecord;

export interface PackOddsRecord {
  rarity: CardRarity;
  weight: number;
  /** Always resolves to this specific card when rolled — see cards/domain/packOpening.ts. */
  pinnedCardId: string | null;
}

export interface CardPackRecord {
  id: string;
  name: string;
  description: string | null;
  priceCoins: bigint | null;
  cardCount: number;
}

export interface EnsurePackInput extends CardPackRecord {
  odds: (PackOddsRecord & { id: string })[];
}

export interface UserCardRecord {
  id: string;
  userId: string;
  cardId: string;
  level: number;
  isFavorite: boolean;
  acquiredAt: Date;
}

export interface RecordPackOpeningInput {
  /**
   * Caller-supplied, not DB-generated — derived from the same
   * idempotencyKey used for the wallet debit (see
   * cards/services/openPack.ts). A retried request (same requestId)
   * resolves to the SAME opening and returns the cards already drawn,
   * instead of silently granting a second free set on top of a
   * once-only wallet charge.
   */
  openingId: string;
  userId: string;
  packId: string;
  drawnCardIds: string[];
}

export interface RecordPackOpeningOutput {
  openingId: string;
  cards: UserCardRecord[];
}

/**
 * The card catalog (Card/CardPack/PackOdds) is fixed, shared world content
 * — get-or-created idempotently by a stable, hand-picked id (see
 * cards/domain/catalog.ts), the exact same pattern career/domain/
 * clubNaming.ts uses for the rival club pool. No new schema column was
 * needed for this: `Card.id`/`CardPack.id` already accept an explicit
 * value instead of the `cuid()` default.
 */
export interface CardRepository {
  ensureCard(input: EnsureCardInput): Promise<CardRecord>;
  ensurePack(input: EnsurePackInput): Promise<CardPackRecord>;
  listActivePacks(): Promise<CardPackRecord[]>;
  getPack(packId: string): Promise<CardPackRecord | null>;
  getPackOdds(packId: string): Promise<PackOddsRecord[]>;
  getCardsByRarity(rarity: CardRarity): Promise<CardRecord[]>;
  getCard(cardId: string): Promise<CardRecord | null>;
  /** The whole fixed catalog — small enough (15 cards) to load in one call instead of one round trip per id. */
  listAllCards(): Promise<CardRecord[]>;
  /** Case-insensitive exact match on name — used by /carta and /favoritar, which take a name, not a catalog id. */
  findCardByName(name: string): Promise<CardRecord | null>;
  /** Atomically records a PackOpening and the UserCard rows it produced. */
  recordPackOpening(input: RecordPackOpeningInput): Promise<RecordPackOpeningOutput>;
  listUserCards(userId: string): Promise<UserCardRecord[]>;
  setFavorite(userCardId: string, userId: string, isFavorite: boolean): Promise<UserCardRecord>;
}
