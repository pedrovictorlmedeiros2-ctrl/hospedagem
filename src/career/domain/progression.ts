import type { CareerStage } from "@prisma/client";

/**
 * v1 heuristic, not calibrated against real usage data (there isn't any
 * yet) — deliberately simple and documented as such, same spirit as the
 * OVR weights in player/domain/attributes.ts. Revisit once there's real
 * distribution of appearances/ratings to tune against.
 */
export function nextCareerStage(
  current: CareerStage,
  appearances: number,
  avgRating: number,
): CareerStage {
  if (current === "RESERVE" && appearances >= 3 && avgRating >= 6.5) return "PROFESSIONAL";
  if (current === "PROFESSIONAL" && appearances >= 8 && avgRating >= 7.0) return "STARTER";
  return current;
}
