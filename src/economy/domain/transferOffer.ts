import type { Rng } from "../../game/domain/rng.js";

export interface TransferOfferInput {
  rng: Rng;
  playerMarketValue: number;
  playerOverall: number;
  toClubReputation: number;
}

export interface TransferOffer {
  available: boolean;
  fee: number;
}

const REPUTATION_TO_OVERALL_FACTOR = 0.9;
const FEE_MULTIPLIER_MIN = 0.9;
const FEE_MULTIPLIER_RANGE = 0.6; // fee lands anywhere in [0.9x, 1.5x] of market value

/**
 * Whether a rival club would make an offer for the player today, and for
 * how much. Deterministic given `rng` — callers derive the seed from
 * (player, destination club, calendar day), so "browsing" offers and
 * "accepting" one on the same day always agree on the same number without
 * needing to persist a proposal row (the same trick
 * career/services/trainPlayer.ts uses for its intensive-training
 * idempotency key).
 */
export function generateTransferOffer(input: TransferOfferInput): TransferOffer {
  const requiredOverall = Math.round(input.toClubReputation * REPUTATION_TO_OVERALL_FACTOR);
  if (input.playerOverall < requiredOverall) {
    return { available: false, fee: 0 };
  }

  const multiplier = FEE_MULTIPLIER_MIN + input.rng() * FEE_MULTIPLIER_RANGE;
  return { available: true, fee: Math.round(input.playerMarketValue * multiplier) };
}

const SIGNING_BONUS_RATE = 0.15;

/**
 * What the PLAYER actually pockets from a transfer — not the whole
 * negotiated fee. Real transfer fees are paid by the buying club to the
 * selling club, not handed to the player; a signing bonus is the
 * realistic (and much smaller) piece that's actually theirs. This also
 * closes an exploit: paying out the full fee on every hop would let a
 * player farm near-unlimited coins by bouncing between the 6 rival clubs
 * with no real cost (see MIN_DAYS_BETWEEN_TRANSFERS below for the other
 * half of that mitigation).
 */
export function calculateSigningBonus(fee: number): number {
  return Math.round(fee * SIGNING_BONUS_RATE);
}

export const MIN_DAYS_BETWEEN_TRANSFERS = 30;

/** Same shape as career/domain/training.ts's canTrainNow — a real cooldown, not just an idempotency key, so a transfer can't be re-triggered for a *different* destination club moments later. */
export function canTransferNow(lastTransferAt: Date | null, now: Date): boolean {
  if (!lastTransferAt) return true;
  const daysSince = (now.getTime() - lastTransferAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= MIN_DAYS_BETWEEN_TRANSFERS;
}
