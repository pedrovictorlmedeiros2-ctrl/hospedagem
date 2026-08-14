import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ProfileNotFoundError } from "../../player/domain/errors.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import { ValidationError } from "../../shared/errors.js";
import type { RivalryRepository } from "../ports/rivalryRepository.js";

export interface ViewRivalryDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  rivalryRepository: RivalryRepository;
}

export interface ViewRivalryInput {
  discordId: string;
  opponentDiscordId: string;
}

export interface ViewRivalryOutput {
  opponentNickname: string;
  myWins: number;
  opponentWins: number;
  lastMatchAt: Date | null;
}

export async function viewRivalry(deps: ViewRivalryDeps, input: ViewRivalryInput): Promise<ViewRivalryOutput> {
  const me = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const opponent = await deps.userRepository.ensureUserForDiscordId(input.opponentDiscordId);

  const myPlayer = await deps.playerRepository.findByUserId(me.id);
  if (!myPlayer) {
    throw new ProfileNotFoundError();
  }
  const opponentPlayer = await deps.playerRepository.findByUserId(opponent.id);
  if (!opponentPlayer) {
    throw new ValidationError("Esse jogador ainda não criou um perfil (/criar-perfil).");
  }

  const rivalry = await deps.rivalryRepository.getOrCreateRivalry(myPlayer.id, opponentPlayer.id);
  const iAmPlayerA = rivalry.playerAId === myPlayer.id;

  return {
    opponentNickname: opponentPlayer.nickname,
    myWins: iAmPlayerA ? rivalry.playerAWins : rivalry.playerBWins,
    opponentWins: iAmPlayerA ? rivalry.playerBWins : rivalry.playerAWins,
    lastMatchAt: rivalry.lastMatchAt,
  };
}
