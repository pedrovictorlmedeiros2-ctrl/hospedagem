import { calculateMarketValue } from "../domain/marketValue.js";
import { calculateReleaseClause, calculateSalaryPerMatch, contractEndDate, isContractExpired } from "../domain/contract.js";
import type { ContractRecord, MarketRepository } from "../ports/marketRepository.js";

export interface EnsureContractDeps {
  marketRepository: MarketRepository;
}

export interface EnsureContractInput {
  playerId: string;
  clubId: string;
  playerOverall: number;
  playerAge: number;
  now: Date;
}

/**
 * Idempotent bootstrap, same shape as career/services/ensureCareerStarted:
 * makes sure the player has a live contract with their CURRENT club, and
 * signs a fresh one (priced off market value) whenever there isn't one yet,
 * it expired, or it's stale from before a transfer. Safe to call every
 * match — a second call with nothing changed is a cheap no-op read.
 */
export async function ensureContract(deps: EnsureContractDeps, input: EnsureContractInput): Promise<ContractRecord> {
  const existing = await deps.marketRepository.getActiveContract(input.playerId);
  if (existing && existing.clubId === input.clubId && !isContractExpired(existing, input.now)) {
    return existing;
  }

  if (existing) {
    // Either expired, or stale (still points at a club the player already
    // left — the transfer flow terminates the old contract itself, but
    // this is a safe fallback if that step were ever skipped).
    await deps.marketRepository.terminateContract(existing.id);
  }

  const marketValue = calculateMarketValue({ overall: input.playerOverall, age: input.playerAge });
  return deps.marketRepository.createContract({
    playerId: input.playerId,
    clubId: input.clubId,
    salary: calculateSalaryPerMatch(marketValue),
    releaseClause: calculateReleaseClause(marketValue),
    startsAt: input.now,
    endsAt: contractEndDate(input.now),
  });
}
