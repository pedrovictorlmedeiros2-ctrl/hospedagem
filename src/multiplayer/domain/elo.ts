export type DuelOutcome = "CHALLENGER_WIN" | "OPPONENT_WIN" | "DRAW";

export interface EloUpdateInput {
  challengerRating: number;
  opponentRating: number;
  outcome: DuelOutcome;
  kFactor?: number;
}

export interface EloUpdateOutput {
  newChallengerRating: number;
  newOpponentRating: number;
  challengerDelta: number;
  opponentDelta: number;
}

const DEFAULT_K_FACTOR = 32;

/**
 * Standard ELO rating update (same formula used by chess federations),
 * hand-picked K-factor. Symmetric by construction: the challenger's and
 * opponent's expected scores always sum to 1, and their deltas are always
 * opposite in sign (rounding can make the magnitudes differ by at most 1).
 */
export function calculateEloUpdate(input: EloUpdateInput): EloUpdateOutput {
  const k = input.kFactor ?? DEFAULT_K_FACTOR;
  const expectedChallenger = 1 / (1 + 10 ** ((input.opponentRating - input.challengerRating) / 400));
  const expectedOpponent = 1 - expectedChallenger;

  const actualChallenger = input.outcome === "CHALLENGER_WIN" ? 1 : input.outcome === "OPPONENT_WIN" ? 0 : 0.5;
  const actualOpponent = 1 - actualChallenger;

  const challengerDelta = Math.round(k * (actualChallenger - expectedChallenger));
  const opponentDelta = Math.round(k * (actualOpponent - expectedOpponent));

  return {
    newChallengerRating: input.challengerRating + challengerDelta,
    newOpponentRating: input.opponentRating + opponentDelta,
    challengerDelta,
    opponentDelta,
  };
}
