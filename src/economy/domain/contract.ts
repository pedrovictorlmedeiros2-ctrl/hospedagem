export const CONTRACT_DURATION_DAYS = 180;

const SALARY_RATE_OF_VALUE = 0.004;
const MIN_SALARY_PER_MATCH = 5;
const RELEASE_CLAUSE_MULTIPLIER = 1.5;

/** Wage paid per match played, derived from a coin value (market value for a fresh contract, negotiated fee for a post-transfer one). Never below a small floor, so even a low-value player has a reason to keep playing. */
export function calculateSalaryPerMatch(baseValue: number): number {
  return Math.max(MIN_SALARY_PER_MATCH, Math.round(baseValue * SALARY_RATE_OF_VALUE));
}

export function calculateReleaseClause(marketValue: number): number {
  return Math.round(marketValue * RELEASE_CLAUSE_MULTIPLIER);
}

export function contractEndDate(startsAt: Date): Date {
  return new Date(startsAt.getTime() + CONTRACT_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export function isContractExpired(contract: { endsAt: Date }, now: Date): boolean {
  return now.getTime() >= contract.endsAt.getTime();
}
