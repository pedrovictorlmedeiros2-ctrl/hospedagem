export interface MarketValueInput {
  overall: number;
  age: number;
}

const VALUE_PER_OVERALL_SQUARED = 5;

function ageMultiplier(age: number): number {
  if (age <= 21) return 1.2;
  if (age <= 28) return 1.0;
  if (age <= 32) return 0.7;
  return 0.4;
}

/**
 * Coin value used to price contracts, release clauses and transfer fees.
 * Hand-tuned for a v1, same accepted-risk category as the match-engine AI
 * weights and the match-reward weights (see docs/RISK_REGISTER.md) — not
 * calibrated against any real economy data.
 */
export function calculateMarketValue(input: MarketValueInput): number {
  const base = input.overall * input.overall * VALUE_PER_OVERALL_SQUARED;
  return Math.round(base * ageMultiplier(input.age));
}

/** Mirrors player/services/createPlayerProfile.ts's `ageToBirthDate` — same UTC-year-subtraction model, just inverted. */
export function ageFromBirthDate(birthDate: Date, now: Date): number {
  return now.getUTCFullYear() - birthDate.getUTCFullYear();
}
