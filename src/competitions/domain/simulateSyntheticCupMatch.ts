import { createRng, randomInt } from "../../game/domain/rng.js";

export interface SyntheticCupMatchResult {
  homeScore: number;
  awayScore: number;
}

/**
 * A cup match between two synthetic (non-player-controlled) clubs never
 * gets played by anyone — nobody's career happens to be pointed at either
 * of these two teams for this exact fixture, and there's no reason to
 * wait for a coincidence that may never happen. Resolved instantly with a
 * plausible scoreline instead, deterministic by matchId so re-deriving it
 * later (e.g. rebuilding the bracket view) always agrees with the
 * original call. See CupRepository.recordFixtureResult, which calls this
 * for every still-pending match in a round the moment the real player's
 * own match in that round is recorded.
 */
export function simulateSyntheticCupMatch(matchId: string): SyntheticCupMatchResult {
  const rng = createRng(`${matchId}:synthetic`);
  return { homeScore: randomInt(rng, 0, 3), awayScore: randomInt(rng, 0, 3) };
}
