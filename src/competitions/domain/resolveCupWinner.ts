import { createRng, randomInt } from "../../game/domain/rng.js";

export interface CupMatchScore {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

/**
 * A knockout match can never end without a winner. A drawn scoreline is
 * resolved as if by a penalty shootout — not genuinely simulated kick by
 * kick (only who advances matters for bracket progression), but
 * deterministic: seeded by `matchId`, so re-deriving the winner later
 * (e.g. rebuilding the bracket view from stored Match rows, which have no
 * dedicated "winner" column) always agrees with the original call.
 */
export function resolveCupWinner(match: CupMatchScore): string {
  if (match.homeScore > match.awayScore) return match.homeTeamId;
  if (match.awayScore > match.homeScore) return match.awayTeamId;
  const rng = createRng(`${match.matchId}:penalties`);
  return randomInt(rng, 0, 1) === 0 ? match.homeTeamId : match.awayTeamId;
}
