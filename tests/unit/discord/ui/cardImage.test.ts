import type { CardRarity, Position } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildCardAttachment, renderCardImage, type CardImageInput } from "../../../../src/discord/ui/cardImage.js";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function outfieldCard(overrides: Partial<CardImageInput> = {}): CardImageInput {
  return {
    name: "Yusuf Demirci",
    position: "AM",
    overall: 72,
    rarity: "RARE",
    ability: "Visão de jogo",
    attributes: { pace: 68, shooting: 66, passing: 74, dribbling: 76, defending: 42, physical: 55 },
    ...overrides,
  };
}

const ALL_RARITIES: CardRarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY", "SPECIAL"];

describe("renderCardImage", () => {
  it("returns a valid PNG buffer for every rarity tier", () => {
    for (const rarity of ALL_RARITIES) {
      const buf = renderCardImage(outfieldCard({ rarity }));
      expect(buf.subarray(0, 8)).toEqual(PNG_MAGIC);
      expect(buf.length).toBeGreaterThan(1000);
    }
  });

  it("renders a goalkeeper card using goalkeeper attributes, not outfield ones", () => {
    const input: CardImageInput = {
      name: "Sten Aurelius",
      position: "GK",
      overall: 80,
      rarity: "EPIC",
      ability: "Reflexo felino",
      attributes: { gkReflexes: 82, gkPositioning: 78, gkHandling: 80, gkAerial: 75, gkOneOnOne: 79, gkPenalties: 70 },
    };
    const buf = renderCardImage(input);
    expect(buf.subarray(0, 8)).toEqual(PNG_MAGIC);
  });

  it("does not throw for a card with no ability (no ribbon to draw)", () => {
    expect(() => renderCardImage(outfieldCard({ ability: null }))).not.toThrow();
  });

  it("does not throw for an unusually long name or ability string", () => {
    const buf = renderCardImage(
      outfieldCard({
        name: "O Fenômeno de Vale Verde do Extremo Norte",
        ability: "Um apelido de habilidade absurdamente comprido só para testar o auto-fit",
      }),
    );
    expect(buf.subarray(0, 8)).toEqual(PNG_MAGIC);
  });

  it("does not throw when an attribute is missing from the input map (defensive default)", () => {
    expect(() => renderCardImage(outfieldCard({ attributes: { pace: 68 } }))).not.toThrow();
  });

  it("covers every outfield position without throwing", () => {
    const positions: Position[] = ["CB", "LB", "RB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST"];
    for (const position of positions) {
      expect(() => renderCardImage(outfieldCard({ position }))).not.toThrow();
    }
  });
});

describe("buildCardAttachment", () => {
  it("wraps the rendered PNG buffer in an AttachmentBuilder with the given filename", () => {
    const attachment = buildCardAttachment(outfieldCard(), "card-0.png");
    expect(attachment.name).toBe("card-0.png");
    expect(Buffer.isBuffer(attachment.attachment)).toBe(true);
    expect((attachment.attachment as Buffer).subarray(0, 8)).toEqual(PNG_MAGIC);
  });
});
