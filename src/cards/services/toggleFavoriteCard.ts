import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ValidationError } from "../../shared/errors.js";
import type { CardRecord, CardRepository } from "../ports/cardRepository.js";

export interface ToggleFavoriteCardDeps {
  userRepository: UserRepository;
  cardRepository: CardRepository;
}

export interface ToggleFavoriteCardInput {
  discordId: string;
  cardName: string;
}

export interface ToggleFavoriteCardOutput {
  card: CardRecord;
  isFavorite: boolean;
}

/**
 * Copies of the same card are fungible in every way except favorite/level
 * (level is always 1 today — see RISK_REGISTER.md), so there's no
 * meaningful "which specific copy" for a user to pick. This toggles: if
 * any owned copy is already favorited, unfavorite it; otherwise favorite
 * the first owned copy.
 */
export async function toggleFavoriteCard(
  deps: ToggleFavoriteCardDeps,
  input: ToggleFavoriteCardInput,
): Promise<ToggleFavoriteCardOutput> {
  const card = await deps.cardRepository.findCardByName(input.cardName);
  if (!card) {
    throw new ValidationError(`Nenhuma carta chamada "${input.cardName}" foi encontrada.`);
  }

  const user = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const owned = await deps.cardRepository.listUserCards(user.id);
  const ownedCopies = owned.filter((userCard) => userCard.cardId === card.id);
  if (ownedCopies.length === 0) {
    throw new ValidationError(`Você ainda não tem nenhuma cópia de "${card.name}".`);
  }

  const alreadyFavorited = ownedCopies.find((userCard) => userCard.isFavorite);
  const target = alreadyFavorited ?? ownedCopies[0] ?? null;
  if (!target) {
    throw new Error("Internal error: ownedCopies was non-empty but no element could be read");
  }

  const updated = await deps.cardRepository.setFavorite(target.id, user.id, !target.isFavorite);
  return { card, isFavorite: updated.isFavorite };
}
