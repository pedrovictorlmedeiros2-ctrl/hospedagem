import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ValidationError } from "../../shared/errors.js";
import type { CardRecord, CardRepository } from "../ports/cardRepository.js";

export interface ViewCardDetailDeps {
  userRepository: UserRepository;
  cardRepository: CardRepository;
}

export interface ViewCardDetailInput {
  discordId: string;
  cardName: string;
}

export interface ViewCardDetailOutput {
  card: CardRecord;
  ownedCount: number;
  hasFavorite: boolean;
}

export async function viewCardDetail(deps: ViewCardDetailDeps, input: ViewCardDetailInput): Promise<ViewCardDetailOutput> {
  const card = await deps.cardRepository.findCardByName(input.cardName);
  if (!card) {
    throw new ValidationError(`Nenhuma carta chamada "${input.cardName}" foi encontrada.`);
  }

  const user = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const owned = await deps.cardRepository.listUserCards(user.id);
  const ownedCopies = owned.filter((userCard) => userCard.cardId === card.id);

  return {
    card,
    ownedCount: ownedCopies.length,
    hasFavorite: ownedCopies.some((userCard) => userCard.isFavorite),
  };
}
