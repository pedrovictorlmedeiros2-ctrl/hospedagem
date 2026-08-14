import { ensureCareerStarted, type CareerWorldContext } from "../../career/services/ensureCareerStarted.js";
import { ensureRivalTeams } from "../../career/services/ensureLeagueTeams.js";
import type { CareerRepository } from "../../career/ports/careerRepository.js";
import { createRng } from "../../game/domain/rng.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import { ageFromBirthDate, calculateMarketValue } from "../domain/marketValue.js";
import { generateTransferOffer } from "../domain/transferOffer.js";

export interface ListTransferOffersDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
}

export interface ListTransferOffersInput {
  discordId: string;
  now?: Date;
}

export interface TransferOfferView {
  clubName: string;
  fee: number;
}

export interface ListTransferOffersOutput {
  currentClubName: string;
  offers: TransferOfferView[];
}

function offerSeedFor(context: CareerWorldContext, rivalClubId: string, now: Date): string {
  const dayBucket = now.toISOString().slice(0, 10);
  return `transfer-offer:${context.player.id}:${rivalClubId}:${dayBucket}`;
}

export async function listTransferOffers(
  deps: ListTransferOffersDeps,
  input: ListTransferOffersInput,
): Promise<ListTransferOffersOutput> {
  const now = input.now ?? new Date();
  const context = await ensureCareerStarted(deps, input.discordId);
  const { player, club, season } = context;

  const rivals = await ensureRivalTeams(deps.careerRepository, season.id);
  const marketValue = calculateMarketValue({ overall: player.overall, age: ageFromBirthDate(player.birthDate, now) });

  const offers: TransferOfferView[] = [];
  for (const rival of rivals) {
    if (rival.club.id === club.id) continue; // already there, post-transfer
    const offer = generateTransferOffer({
      rng: createRng(offerSeedFor(context, rival.club.id, now)),
      playerMarketValue: marketValue,
      playerOverall: player.overall,
      toClubReputation: rival.club.reputation,
    });
    if (offer.available) {
      offers.push({ clubName: rival.club.name, fee: offer.fee });
    }
  }

  return { currentClubName: club.name, offers };
}
