import { ensureCareerStarted } from "../../career/services/ensureCareerStarted.js";
import type { CareerRepository } from "../../career/ports/careerRepository.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import { ageFromBirthDate, calculateMarketValue } from "../domain/marketValue.js";
import type { ContractRecord, MarketRepository } from "../ports/marketRepository.js";
import { ensureContract } from "./ensureContract.js";

export interface ViewContractDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
  marketRepository: MarketRepository;
}

export interface ViewContractInput {
  discordId: string;
  now?: Date;
}

export interface ViewContractOutput {
  clubName: string;
  contract: ContractRecord;
  marketValue: number;
}

export async function viewContract(deps: ViewContractDeps, input: ViewContractInput): Promise<ViewContractOutput> {
  const now = input.now ?? new Date();
  const { player, club } = await ensureCareerStarted(deps, input.discordId);

  const contract = await ensureContract(deps, {
    playerId: player.id,
    clubId: club.id,
    playerOverall: player.overall,
    playerAge: ageFromBirthDate(player.birthDate, now),
    now,
  });

  const marketValue = calculateMarketValue({ overall: player.overall, age: ageFromBirthDate(player.birthDate, now) });
  return { clubName: club.name, contract, marketValue };
}
