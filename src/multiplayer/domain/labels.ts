import type { DuelTier } from "@prisma/client";

export const DUEL_TIER_LABELS: Record<DuelTier, string> = {
  BRONZE: "Bronze",
  SILVER: "Prata",
  GOLD: "Ouro",
  ELITE: "Elite",
};

export const DUEL_TIER_EMOJI: Record<DuelTier, string> = {
  BRONZE: "🥉",
  SILVER: "🥈",
  GOLD: "🥇",
  ELITE: "💎",
};
