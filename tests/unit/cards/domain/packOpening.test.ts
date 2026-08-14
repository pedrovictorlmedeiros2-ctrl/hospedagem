import type { CardRarity } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { drawPackCards, type DrawOdds } from "../../../../src/cards/domain/packOpening.js";
import { createRng } from "../../../../src/game/domain/rng.js";

const SIMPLE_ODDS: DrawOdds[] = [
  { rarity: "COMMON", weight: 70, pinnedCardId: null },
  { rarity: "RARE", weight: 25, pinnedCardId: null },
  { rarity: "EPIC", weight: 5, pinnedCardId: null },
];

const CARDS_BY_RARITY = new Map<CardRarity, string[]>([
  ["COMMON", ["common-1", "common-2"]],
  ["RARE", ["rare-1"]],
  ["EPIC", ["epic-1"]],
]);

describe("drawPackCards", () => {
  it("draws exactly cardCount cards", () => {
    const drawn = drawPackCards({ rng: createRng("seed-1"), cardCount: 5, odds: SIMPLE_ODDS, cardsByRarity: CARDS_BY_RARITY });
    expect(drawn).toHaveLength(5);
  });

  it("is deterministic for the same seed", () => {
    const a = drawPackCards({ rng: createRng("same-seed"), cardCount: 5, odds: SIMPLE_ODDS, cardsByRarity: CARDS_BY_RARITY });
    const b = drawPackCards({ rng: createRng("same-seed"), cardCount: 5, odds: SIMPLE_ODDS, cardsByRarity: CARDS_BY_RARITY });
    expect(b).toEqual(a);
  });

  it("always picks a card belonging to the rolled rarity's pool", () => {
    const drawn = drawPackCards({ rng: createRng("seed-2"), cardCount: 200, odds: SIMPLE_ODDS, cardsByRarity: CARDS_BY_RARITY });
    for (const card of drawn) {
      const pool = CARDS_BY_RARITY.get(card.rarity) ?? [];
      expect(pool).toContain(card.cardId);
    }
  });

  it("always resolves a pinned rarity to the pinned card, never the pool", () => {
    const odds: DrawOdds[] = [{ rarity: "SPECIAL", weight: 1, pinnedCardId: "the-special-card" }];
    const drawn = drawPackCards({ rng: createRng("seed-3"), cardCount: 10, odds, cardsByRarity: new Map() });
    expect(drawn.every((card) => card.cardId === "the-special-card")).toBe(true);
  });

  it("respects weighting over many draws (COMMON should vastly outnumber EPIC)", () => {
    const drawn = drawPackCards({ rng: createRng("seed-4"), cardCount: 1000, odds: SIMPLE_ODDS, cardsByRarity: CARDS_BY_RARITY });
    const commonCount = drawn.filter((c) => c.rarity === "COMMON").length;
    const epicCount = drawn.filter((c) => c.rarity === "EPIC").length;
    expect(commonCount).toBeGreaterThan(epicCount * 5);
  });

  it("throws a clear internal error if a non-pinned rarity has no cards in its pool", () => {
    const odds: DrawOdds[] = [{ rarity: "LEGENDARY", weight: 1, pinnedCardId: null }];
    expect(() => drawPackCards({ rng: createRng("seed-5"), cardCount: 1, odds, cardsByRarity: new Map() })).toThrow(
      /no cards available/,
    );
  });
});
