import type { DuelTier } from "@prisma/client";

/**
 * Rating bands for display/flavor. A fresh player starts at
 * STARTING_GLOBAL_RATING (1000, see player/domain/attributes.ts), which
 * lands them near the bottom of SILVER — losing duels can drop them into
 * BRONZE, winning climbs them toward GOLD/ELITE. Not currently used to
 * gate who can challenge whom (see docs/adr — a v1 scope decision).
 */
export function tierForRating(rating: number): DuelTier {
  if (rating >= 1600) return "ELITE";
  if (rating >= 1300) return "GOLD";
  if (rating >= 1000) return "SILVER";
  return "BRONZE";
}
