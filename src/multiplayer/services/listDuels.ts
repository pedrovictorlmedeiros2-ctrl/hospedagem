import type { DuelStatus, DuelTier } from "@prisma/client";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { DuelRepository } from "../ports/duelRepository.js";

export interface ListDuelsDeps {
  userRepository: UserRepository;
  duelRepository: DuelRepository;
}

export interface ListDuelsInput {
  discordId: string;
}

export interface DuelView {
  id: string;
  role: "CHALLENGER" | "OPPONENT";
  counterpartDiscordId: string;
  tier: DuelTier;
  status: DuelStatus;
  /** null = draw or not yet resolved. */
  isWinner: boolean | null;
}

export interface ListDuelsOutput {
  duels: DuelView[];
}

export async function listDuels(deps: ListDuelsDeps, input: ListDuelsInput): Promise<ListDuelsOutput> {
  const user = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const records = await deps.duelRepository.listDuelsForUser(user.id);

  const duels: DuelView[] = [];
  for (const duel of records) {
    const isChallenger = duel.challengerId === user.id;
    const counterpartId = isChallenger ? duel.opponentId : duel.challengerId;
    const counterpart = await deps.userRepository.getById(counterpartId);
    duels.push({
      id: duel.id,
      role: isChallenger ? "CHALLENGER" : "OPPONENT",
      counterpartDiscordId: counterpart?.discordId ?? "desconhecido",
      tier: duel.tier,
      status: duel.status,
      isWinner: duel.winnerId === null ? null : duel.winnerId === user.id,
    });
  }

  return { duels };
}
