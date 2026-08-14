import { ensureCareerStarted } from "../../career/services/ensureCareerStarted.js";
import { ensureRivalTeams } from "../../career/services/ensureLeagueTeams.js";
import type { CareerRepository } from "../../career/ports/careerRepository.js";
import { createRng } from "../../game/domain/rng.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import { ValidationError } from "../../shared/errors.js";
import { calculateReleaseClause, calculateSalaryPerMatch, contractEndDate } from "../domain/contract.js";
import { TransferCooldownError } from "../domain/errors.js";
import { ageFromBirthDate, calculateMarketValue } from "../domain/marketValue.js";
import {
  calculateSigningBonus,
  canTransferNow,
  generateTransferOffer,
  MIN_DAYS_BETWEEN_TRANSFERS,
} from "../domain/transferOffer.js";
import type { MarketRepository } from "../ports/marketRepository.js";
import type { WalletRepository } from "../ports/walletRepository.js";

export interface AcceptTransferOfferDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
  marketRepository: MarketRepository;
  walletRepository: WalletRepository;
}

export interface AcceptTransferOfferInput {
  discordId: string;
  /** Matched case-insensitively against the club names shown by listTransferOffers — no ids exposed to the Discord layer. */
  toClubName: string;
  now?: Date;
}

export interface AcceptTransferOfferOutput {
  fromClubName: string;
  toClubName: string;
  fee: number;
  signingBonus: number;
  newSalary: number;
}

export async function acceptTransferOffer(
  deps: AcceptTransferOfferDeps,
  input: AcceptTransferOfferInput,
): Promise<AcceptTransferOfferOutput> {
  const now = input.now ?? new Date();
  const { player, club, team, season } = await ensureCareerStarted(deps, input.discordId);

  const hasActiveInjury = await deps.careerRepository.hasActiveInjury(player.id, now);
  if (hasActiveInjury) {
    throw new ValidationError("Não é possível assinar uma transferência enquanto estiver machucado.");
  }

  const recentTransfers = await deps.marketRepository.listRecentTransfers(player.id, 1);
  const lastTransferAt = recentTransfers[0]?.announcedAt ?? null;
  if (!canTransferNow(lastTransferAt, now)) {
    const daysSince = lastTransferAt ? (now.getTime() - lastTransferAt.getTime()) / (1000 * 60 * 60 * 24) : 0;
    throw new TransferCooldownError(MIN_DAYS_BETWEEN_TRANSFERS - daysSince);
  }

  const rivals = await ensureRivalTeams(deps.careerRepository, season.id);
  const wanted = input.toClubName.trim().toLowerCase();
  const destination = rivals.find((rival) => rival.club.name.toLowerCase() === wanted);
  if (!destination || destination.club.id === club.id) {
    throw new ValidationError("Clube não encontrado entre as propostas disponíveis. Confira /propostas.");
  }

  const marketValue = calculateMarketValue({ overall: player.overall, age: ageFromBirthDate(player.birthDate, now) });
  const dayBucket = now.toISOString().slice(0, 10);
  const offer = generateTransferOffer({
    rng: createRng(`transfer-offer:${player.id}:${destination.club.id}:${dayBucket}`),
    playerMarketValue: marketValue,
    playerOverall: player.overall,
    toClubReputation: destination.club.reputation,
  });
  if (!offer.available) {
    throw new ValidationError(`${destination.club.name} não tem uma proposta por você hoje. Confira /propostas.`);
  }

  const oldContract = await deps.marketRepository.getActiveContract(player.id);
  if (oldContract) {
    await deps.marketRepository.terminateContract(oldContract.id);
  }

  await deps.careerRepository.leaveRoster(team.id, player.id, now);
  const newTeam = await deps.careerRepository.getOrCreateTeam({
    clubId: destination.club.id,
    seasonId: season.id,
    name: destination.club.name,
  });
  await deps.careerRepository.ensureOnRoster({
    teamId: newTeam.id,
    playerId: player.id,
    squadNumber: player.shirtNumber,
  });
  await deps.careerRepository.updateCareerClub(player.id, destination.club.id);

  await deps.marketRepository.recordTransfer({
    playerId: player.id,
    fromClubId: club.id,
    toClubId: destination.club.id,
    seasonId: season.id,
    type: "PERMANENT",
    fee: offer.fee,
  });

  const signingBonus = calculateSigningBonus(offer.fee);
  await deps.walletRepository.applyTransaction({
    userId: player.userId,
    currency: "COINS",
    type: "SOURCE",
    amount: BigInt(signingBonus),
    reason: "TRANSFER_SIGNING_BONUS",
    idempotencyKey: `transfer-bonus:${player.id}:${destination.club.id}:${dayBucket}`,
  });

  // Priced off the negotiated fee rather than raw market value, so a
  // richer offer (bigger club, better multiplier) also means a better
  // wage at the new club — not just a bigger one-time bonus.
  const newSalary = calculateSalaryPerMatch(offer.fee);
  await deps.marketRepository.createContract({
    playerId: player.id,
    clubId: destination.club.id,
    salary: newSalary,
    releaseClause: calculateReleaseClause(marketValue),
    startsAt: now,
    endsAt: contractEndDate(now),
  });

  return {
    fromClubName: club.name,
    toClubName: destination.club.name,
    fee: offer.fee,
    signingBonus,
    newSalary,
  };
}
