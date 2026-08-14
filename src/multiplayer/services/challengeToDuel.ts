import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ProfileNotFoundError } from "../../player/domain/errors.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import { ConflictError, ValidationError } from "../../shared/errors.js";
import { tierForRating } from "../domain/tier.js";
import type { DuelRecord, DuelRepository } from "../ports/duelRepository.js";

export interface ChallengeToDuelDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  duelRepository: DuelRepository;
}

export interface ChallengeToDuelInput {
  discordId: string;
  opponentDiscordId: string;
}

export interface ChallengeToDuelOutput {
  duel: DuelRecord;
}

export async function challengeToDuel(
  deps: ChallengeToDuelDeps,
  input: ChallengeToDuelInput,
): Promise<ChallengeToDuelOutput> {
  if (input.discordId === input.opponentDiscordId) {
    throw new ValidationError("Você não pode desafiar a si mesmo para um duelo.");
  }

  const challenger = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const opponent = await deps.userRepository.ensureUserForDiscordId(input.opponentDiscordId);

  const challengerPlayer = await deps.playerRepository.findByUserId(challenger.id);
  if (!challengerPlayer) {
    throw new ProfileNotFoundError();
  }
  const opponentPlayer = await deps.playerRepository.findByUserId(opponent.id);
  if (!opponentPlayer) {
    throw new ValidationError("Esse jogador ainda não criou um perfil (/criar-perfil) — não é possível desafiá-lo.");
  }

  const existingOpenDuel = await deps.duelRepository.findOpenDuelBetween(challenger.id, opponent.id);
  if (existingOpenDuel) {
    throw new ConflictError("Já existe um duelo em aberto entre vocês dois.");
  }

  const tier = tierForRating(challengerPlayer.globalRating);
  const duel = await deps.duelRepository.createDuel({ challengerId: challenger.id, opponentId: opponent.id, tier });

  return { duel };
}
