import type { CardRarity, Position } from "@prisma/client";

/**
 * Fictional cards only — invented names, not real players (same discipline
 * as career/domain/clubNaming.ts for clubs). This is a fixed, shared
 * catalog: every user's pack openings draw from the exact same pool, the
 * same "shared world" principle already used for rival clubs.
 *
 * IDs are deliberately meaningful, stable strings (not `cuid()`) so the
 * catalog can be get-or-created idempotently by id alone — no new schema
 * column needed (see cards/services/ensureCatalog.ts).
 */
export interface CatalogCard {
  id: string;
  name: string;
  position: Position;
  overall: number;
  attributes: Record<string, number>;
  rarity: CardRarity;
  ability: string | null;
}

export interface CatalogPackOdds {
  id: string;
  rarity: CardRarity;
  weight: number;
  /** When set, this specific card is what a roll of this rarity always yields — otherwise a random card of that rarity is picked at open time. */
  pinnedCardId: string | null;
}

export interface CatalogPack {
  id: string;
  name: string;
  description: string;
  priceCoins: bigint;
  cardCount: number;
  odds: CatalogPackOdds[];
}

function outfield(pace: number, shooting: number, passing: number, dribbling: number, defending: number, physical: number) {
  return { pace, shooting, passing, dribbling, defending, physical };
}

export const CARDS: CatalogCard[] = [
  // COMMON
  { id: "card-common-01", name: "Bruno Aljezur", position: "CB", overall: 58, attributes: outfield(52, 40, 48, 45, 60, 62), rarity: "COMMON", ability: null },
  { id: "card-common-02", name: "Diego Salinas", position: "CM", overall: 60, attributes: outfield(58, 50, 62, 56, 50, 55), rarity: "COMMON", ability: null },
  { id: "card-common-03", name: "Kofi Nwosu", position: "ST", overall: 61, attributes: outfield(64, 60, 45, 55, 30, 58), rarity: "COMMON", ability: null },
  { id: "card-common-04", name: "Marek Vlček", position: "RB", overall: 57, attributes: outfield(60, 35, 50, 48, 55, 52), rarity: "COMMON", ability: null },
  { id: "card-common-05", name: "Théo Bardin", position: "LW", overall: 59, attributes: outfield(66, 52, 50, 58, 28, 45), rarity: "COMMON", ability: null },
  // RARE
  { id: "card-rare-01", name: "Yusuf Demirci", position: "AM", overall: 72, attributes: outfield(68, 66, 74, 76, 42, 55), rarity: "RARE", ability: "Visão de jogo" },
  { id: "card-rare-02", name: "Anders Falk", position: "CB", overall: 71, attributes: outfield(58, 35, 55, 42, 78, 74), rarity: "RARE", ability: "Antecipação" },
  { id: "card-rare-03", name: "Rafael Quintero", position: "ST", overall: 74, attributes: outfield(76, 75, 52, 68, 32, 64), rarity: "RARE", ability: "Finalizador nato" },
  { id: "card-rare-04", name: "Kenji Osato", position: "DM", overall: 70, attributes: outfield(62, 45, 68, 60, 72, 60), rarity: "RARE", ability: null },
  // EPIC
  { id: "card-epic-01", name: "Emeka Chukwu", position: "ST", overall: 82, attributes: outfield(85, 84, 60, 78, 35, 76), rarity: "EPIC", ability: "Instinto de artilheiro" },
  { id: "card-epic-02", name: "Milo Vasquez", position: "LW", overall: 81, attributes: outfield(90, 70, 65, 86, 30, 55), rarity: "EPIC", ability: "Drible curto" },
  { id: "card-epic-03", name: "Sten Aurelius", position: "GK", overall: 80, attributes: { gkReflexes: 82, gkPositioning: 78, gkHandling: 80, gkAerial: 75, gkOneOnOne: 79, gkPenalties: 70 }, rarity: "EPIC", ability: "Reflexo felino" },
  // LEGENDARY
  { id: "card-legendary-01", name: "Aurélio Ferraz", position: "AM", overall: 89, attributes: outfield(82, 85, 90, 92, 45, 68), rarity: "LEGENDARY", ability: "Maestro" },
  { id: "card-legendary-02", name: "Björn Kastrup", position: "CB", overall: 88, attributes: outfield(70, 42, 68, 55, 92, 88), rarity: "LEGENDARY", ability: "Muralha" },
  // SPECIAL
  { id: "card-special-01", name: "O Fenômeno de Vale Verde", position: "ST", overall: 96, attributes: outfield(95, 96, 78, 94, 40, 82), rarity: "SPECIAL", ability: "Lenda viva" },
];

export const PACKS: CatalogPack[] = [
  {
    id: "pack-bronze",
    name: "Pacote Bronze",
    description: "Chance boa de cartas comuns, com uma pitada de sorte para algo raro.",
    priceCoins: 100n,
    cardCount: 3,
    odds: [
      { id: "odds-bronze-common", rarity: "COMMON", weight: 70, pinnedCardId: null },
      { id: "odds-bronze-rare", rarity: "RARE", weight: 25, pinnedCardId: null },
      { id: "odds-bronze-epic", rarity: "EPIC", weight: 5, pinnedCardId: null },
    ],
  },
  {
    id: "pack-prata",
    name: "Pacote Prata",
    description: "Equilíbrio entre comuns e raras, com chance real de épica ou lendária.",
    priceCoins: 300n,
    cardCount: 3,
    odds: [
      { id: "odds-prata-common", rarity: "COMMON", weight: 40, pinnedCardId: null },
      { id: "odds-prata-rare", rarity: "RARE", weight: 40, pinnedCardId: null },
      { id: "odds-prata-epic", rarity: "EPIC", weight: 18, pinnedCardId: null },
      { id: "odds-prata-legendary", rarity: "LEGENDARY", weight: 2, pinnedCardId: null },
    ],
  },
  {
    id: "pack-ouro",
    name: "Pacote Ouro",
    description: "Só cartas raras pra cima — e uma chance real da carta especial.",
    priceCoins: 800n,
    cardCount: 3,
    odds: [
      { id: "odds-ouro-rare", rarity: "RARE", weight: 30, pinnedCardId: null },
      { id: "odds-ouro-epic", rarity: "EPIC", weight: 45, pinnedCardId: null },
      { id: "odds-ouro-legendary", rarity: "LEGENDARY", weight: 20, pinnedCardId: null },
      { id: "odds-ouro-special", rarity: "SPECIAL", weight: 5, pinnedCardId: "card-special-01" },
    ],
  },
];
