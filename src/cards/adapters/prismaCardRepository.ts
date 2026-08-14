import { Prisma, type CardRarity, type PrismaClient } from "@prisma/client";
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

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaCardRepository implements CardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureCard(input: EnsureCardInput): Promise<CardRecord> {
    const card = await this.prisma.card.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        name: input.name,
        position: input.position,
        overall: input.overall,
        attributes: input.attributes as Prisma.InputJsonValue,
        rarity: input.rarity,
        ability: input.ability,
      },
      update: {},
    });
    return this.toCardDomain(card);
  }

  async ensurePack(input: EnsurePackInput): Promise<CardPackRecord> {
    const pack = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cardPack.upsert({
        where: { id: input.id },
        create: {
          id: input.id,
          name: input.name,
          description: input.description,
          priceCoins: input.priceCoins,
          cardCount: input.cardCount,
        },
        update: {},
      });

      for (const odds of input.odds) {
        await tx.packOdds.upsert({
          where: { id: odds.id },
          create: {
            id: odds.id,
            packId: created.id,
            rarity: odds.rarity,
            weight: odds.weight,
            cardId: odds.pinnedCardId,
          },
          update: {},
        });
      }

      return created;
    });

    return this.toPackDomain(pack);
  }

  async listActivePacks(): Promise<CardPackRecord[]> {
    const packs = await this.prisma.cardPack.findMany({ where: { isActive: true } });
    return packs.map((pack) => this.toPackDomain(pack));
  }

  async getPack(packId: string): Promise<CardPackRecord | null> {
    const pack = await this.prisma.cardPack.findUnique({ where: { id: packId } });
    return pack ? this.toPackDomain(pack) : null;
  }

  async getPackOdds(packId: string): Promise<PackOddsRecord[]> {
    const rows = await this.prisma.packOdds.findMany({ where: { packId } });
    return rows.map((row) => ({ rarity: row.rarity, weight: row.weight, pinnedCardId: row.cardId }));
  }

  async getCardsByRarity(rarity: CardRarity): Promise<CardRecord[]> {
    const cards = await this.prisma.card.findMany({ where: { rarity } });
    return cards.map((card) => this.toCardDomain(card));
  }

  async getCard(cardId: string): Promise<CardRecord | null> {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    return card ? this.toCardDomain(card) : null;
  }

  async listAllCards(): Promise<CardRecord[]> {
    const cards = await this.prisma.card.findMany();
    return cards.map((card) => this.toCardDomain(card));
  }

  async findCardByName(name: string): Promise<CardRecord | null> {
    const card = await this.prisma.card.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    return card ? this.toCardDomain(card) : null;
  }

  async recordPackOpening(input: RecordPackOpeningInput): Promise<RecordPackOpeningOutput> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Explicit id (not the cuid() default) is what makes this
        // idempotent — a retried request with the same openingId collides
        // on the primary key and rolls back before any UserCard is
        // created, instead of granting a second free set of cards.
        const opening = await tx.packOpening.create({
          data: { id: input.openingId, userId: input.userId, packId: input.packId },
        });

        const cards: UserCardRecord[] = [];
        for (const cardId of input.drawnCardIds) {
          const userCard = await tx.userCard.create({
            data: { userId: input.userId, cardId, packOpeningId: opening.id },
          });
          cards.push(this.toUserCardDomain(userCard));
        }

        return { openingId: opening.id, cards };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const rows = await this.prisma.userCard.findMany({ where: { packOpeningId: input.openingId } });
        return { openingId: input.openingId, cards: rows.map((row) => this.toUserCardDomain(row)) };
      }
      throw error;
    }
  }

  async listUserCards(userId: string): Promise<UserCardRecord[]> {
    const rows = await this.prisma.userCard.findMany({ where: { userId }, orderBy: { acquiredAt: "desc" } });
    return rows.map((row) => this.toUserCardDomain(row));
  }

  async setFavorite(userCardId: string, userId: string, isFavorite: boolean): Promise<UserCardRecord> {
    // Scoped by userId, not just id, so a user can never toggle another user's card.
    const row = await this.prisma.userCard.update({
      where: { id: userCardId, userId },
      data: { isFavorite },
    });
    return this.toUserCardDomain(row);
  }

  private toCardDomain(card: {
    id: string;
    name: string;
    position: CardRecord["position"];
    overall: number;
    attributes: unknown;
    rarity: CardRarity;
    ability: string | null;
  }): CardRecord {
    return {
      id: card.id,
      name: card.name,
      position: card.position,
      overall: card.overall,
      attributes: card.attributes as Record<string, number>,
      rarity: card.rarity,
      ability: card.ability,
    };
  }

  private toPackDomain(pack: {
    id: string;
    name: string;
    description: string | null;
    priceCoins: bigint | null;
    cardCount: number;
  }): CardPackRecord {
    return {
      id: pack.id,
      name: pack.name,
      description: pack.description,
      priceCoins: pack.priceCoins,
      cardCount: pack.cardCount,
    };
  }

  private toUserCardDomain(row: {
    id: string;
    userId: string;
    cardId: string;
    level: number;
    isFavorite: boolean;
    acquiredAt: Date;
  }): UserCardRecord {
    return {
      id: row.id,
      userId: row.userId,
      cardId: row.cardId,
      level: row.level,
      isFavorite: row.isFavorite,
      acquiredAt: row.acquiredAt,
    };
  }
}
