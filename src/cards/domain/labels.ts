import type { CardRarity } from "@prisma/client";

export const CARD_RARITY_LABELS: Record<CardRarity, string> = {
  COMMON: "Comum",
  RARE: "Rara",
  EPIC: "Épica",
  LEGENDARY: "Lendária",
  SPECIAL: "Especial",
};

export const CARD_RARITY_EMOJI: Record<CardRarity, string> = {
  COMMON: "⚪",
  RARE: "🔵",
  EPIC: "🟣",
  LEGENDARY: "🟡",
  SPECIAL: "🌟",
};

/** Best-to-worst display order for collection views. */
export const CARD_RARITY_ORDER: CardRarity[] = ["SPECIAL", "LEGENDARY", "EPIC", "RARE", "COMMON"];

/** Display labels for CardRecord.attributes keys (outfield + goalkeeper) — used by /carta's detailed view. */
export const CARD_ATTRIBUTE_LABELS: Record<string, string> = {
  pace: "Ritmo",
  shooting: "Finalização",
  passing: "Passe",
  dribbling: "Drible",
  defending: "Defesa",
  physical: "Físico",
  gkReflexes: "Reflexos",
  gkPositioning: "Posicionamento",
  gkHandling: "Segurança",
  gkAerial: "Jogo aéreo",
  gkOneOnOne: "Um contra um",
  gkPenalties: "Pênaltis",
};
