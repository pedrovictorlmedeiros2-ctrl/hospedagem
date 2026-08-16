import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { CardRarity, Position } from "@prisma/client";
import { AttachmentBuilder } from "discord.js";
import {
  CORE_ATTRIBUTE_SHORT_LABELS,
  GOALKEEPER_ATTRIBUTE_SHORT_LABELS,
} from "../../player/domain/labels.js";

const WIDTH = 440;
const HEIGHT = 640;
const CORNER_RADIUS = 28;

export interface CardImageInput {
  name: string;
  position: Position;
  overall: number;
  rarity: CardRarity;
  ability: string | null;
  attributes: Record<string, number>;
}

interface RarityTheme {
  /** Background gradient stops, top to bottom (2 for a plain gradient, more for SPECIAL's rainbow). */
  gradient: string[];
  border: string;
  textPrimary: string;
  textSecondary: string;
  statValue: string;
}

/** Mirrors CARD_RARITY_EMOJI's tiering (cards/domain/labels.ts) — white/blue/purple/gold/rainbow, translated into an actual color ramp instead of just an emoji. */
const RARITY_THEMES: Record<CardRarity, RarityTheme> = {
  COMMON: {
    gradient: ["#e7ebee", "#aab4bd"],
    border: "#78909c",
    textPrimary: "#20272b",
    textSecondary: "#48545c",
    statValue: "#20272b",
  },
  RARE: {
    gradient: ["#4a90e2", "#12325a"],
    border: "#9dc9f7",
    textPrimary: "#ffffff",
    textSecondary: "#d7e9fb",
    statValue: "#ffffff",
  },
  EPIC: {
    gradient: ["#a55fd6", "#3a1250"],
    border: "#e0b8f5",
    textPrimary: "#ffffff",
    textSecondary: "#f0e0fa",
    statValue: "#ffffff",
  },
  LEGENDARY: {
    gradient: ["#ffe08a", "#a9700a"],
    border: "#fff0bd",
    textPrimary: "#2b1c00",
    textSecondary: "#4a3300",
    statValue: "#2b1c00",
  },
  SPECIAL: {
    gradient: ["#ff5f6d", "#ff9a44", "#c86dd7", "#3f5efb"],
    border: "#ffffff",
    textPrimary: "#ffffff",
    textSecondary: "#fbe8ff",
    statValue: "#ffffff",
  },
};

function roundedRectPath(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function paintBackground(ctx: SKRSContext2D, theme: RarityTheme): void {
  roundedRectPath(ctx, 0, 0, WIDTH, HEIGHT, CORNER_RADIUS);
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  const stops = theme.gradient;
  stops.forEach((color, i) => gradient.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.lineWidth = 6;
  ctx.strokeStyle = theme.border;
  roundedRectPath(ctx, 3, 3, WIDTH - 6, HEIGHT - 6, CORNER_RADIUS - 2);
  ctx.stroke();
}

/**
 * A round "photo slot" with a simple procedural silhouette inside — every
 * player in this game is synthetic (no real photo to show), so this reads
 * as a stylized avatar placeholder rather than a broken/missing image.
 */
function paintPhotoSlot(ctx: SKRSContext2D, theme: RarityTheme, centerX: number, centerY: number, radius: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.stroke();

  ctx.clip();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  // Head.
  ctx.beginPath();
  ctx.arc(centerX, centerY - radius * 0.28, radius * 0.34, 0, Math.PI * 2);
  ctx.fill();
  // Shoulders/torso.
  ctx.beginPath();
  ctx.arc(centerX, centerY + radius * 1.05, radius * 0.72, Math.PI, 0, false);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
}

/** Shrinks the font size until `text` fits within `maxWidth`, down to a floor size — used so a long player name never overflows the card. */
function fitText(ctx: SKRSContext2D, text: string, maxWidth: number, startSize: number, minSize: number, weight: string, family: string): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

const FONT_FAMILY = "'Liberation Sans', 'DejaVu Sans', sans-serif";

function statEntries(input: CardImageInput): [string, number][] {
  if (input.position === "GK") {
    return (Object.entries(GOALKEEPER_ATTRIBUTE_SHORT_LABELS) as [keyof typeof GOALKEEPER_ATTRIBUTE_SHORT_LABELS, string][]).map(
      ([field, short]) => [short, input.attributes[field] ?? 0],
    );
  }
  return (Object.entries(CORE_ATTRIBUTE_SHORT_LABELS) as [keyof typeof CORE_ATTRIBUTE_SHORT_LABELS, string][]).map(
    ([field, short]) => [short, input.attributes[field] ?? 0],
  );
}

/**
 * Renders a FUT-style collectible card as a PNG buffer — pure function, no
 * I/O. Every player in this game is fictional/synthetic (see
 * cards/domain/catalog.ts's doc comment), so there is no real photo to
 * composite; the "photo slot" is a procedural silhouette instead.
 */
export function renderCardImage(input: CardImageInput): Buffer {
  const theme = RARITY_THEMES[input.rarity];
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  paintBackground(ctx, theme);

  // Top-left: overall rating, big.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.textPrimary;
  ctx.font = `900 72px ${FONT_FAMILY}`;
  ctx.textAlign = "left";
  ctx.fillText(String(input.overall), 32, 100);

  // Position, right under the overall.
  ctx.font = `bold 30px ${FONT_FAMILY}`;
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText(input.position, 32, 134);

  // Photo slot, upper-center-right — kept well clear of the OVR digits
  // above it (which can span up to ~y=100 at this font size).
  paintPhotoSlot(ctx, theme, WIDTH / 2 + 30, 230, 100);

  // Name banner.
  const nameY = 400;
  const nameSize = fitText(ctx, input.name, WIDTH - 64, 40, 22, "bold", FONT_FAMILY);
  ctx.font = `bold ${nameSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = theme.textPrimary;
  ctx.textAlign = "center";
  ctx.fillText(input.name, WIDTH / 2, nameY);

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, nameY + 20);
  ctx.lineTo(WIDTH - 64, nameY + 20);
  ctx.stroke();

  // Attribute grid — 2 columns x 3 rows, matching profileCard.ts's
  // ordering (CORE_ATTRIBUTE_SHORT_LABELS / GOALKEEPER_ATTRIBUTE_SHORT_LABELS).
  const stats = statEntries(input);
  const colX = [WIDTH / 2 - 110, WIDTH / 2 + 110];
  const gridTop = nameY + 55;
  const rowSpacing = 46;
  const rowY = [gridTop, gridTop + rowSpacing, gridTop + rowSpacing * 2];
  stats.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = colX[col]!;
    const y = rowY[row]!;

    ctx.textAlign = "left";
    ctx.font = `800 26px ${FONT_FAMILY}`;
    ctx.fillStyle = theme.statValue;
    ctx.fillText(String(value), x - 60, y);

    ctx.font = `bold 20px ${FONT_FAMILY}`;
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText(label, x - 15, y);
  });

  // Ability ribbon, if the card has one — no emoji glyph (this
  // environment's fonts don't carry color-emoji outlines, so ✨ etc.
  // render as a tofu box; see docs/RISK_REGISTER.md).
  if (input.ability) {
    const ribbonY = rowY[2]! + 34;
    const ribbonHeight = 40;
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    roundedRectPath(ctx, 32, ribbonY, WIDTH - 64, ribbonHeight, 10);
    ctx.fill();

    ctx.textAlign = "center";
    const label = `HABILIDADE: ${input.ability.toUpperCase()}`;
    const abilitySize = fitText(ctx, label, WIDTH - 96, 18, 12, "bold", FONT_FAMILY);
    ctx.font = `bold ${abilitySize}px ${FONT_FAMILY}`;
    ctx.fillStyle = theme.textPrimary;
    ctx.fillText(label, WIDTH / 2, ribbonY + ribbonHeight / 2 + abilitySize / 3);
  }

  return canvas.toBuffer("image/png");
}

/**
 * Renders a card and wraps it as a Discord attachment, ready to pass in
 * `files:` alongside a Components V2 message — pair with a
 * `MediaGalleryItemBuilder().setURL('attachment://' + filename)` in the
 * container to actually display it. `filename` must be unique within the
 * message (e.g. include an index) when more than one card image is
 * attached at once, since a pack can draw the same card more than once.
 */
export function buildCardAttachment(input: CardImageInput, filename: string): AttachmentBuilder {
  return new AttachmentBuilder(renderCardImage(input), { name: filename });
}
