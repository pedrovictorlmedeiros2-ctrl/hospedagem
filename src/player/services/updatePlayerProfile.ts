import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ValidationError } from "../../shared/errors.js";
import { BACKGROUND_CHOICES, CARD_STYLE_CHOICES, FRAME_CHOICES, THEME_CHOICES } from "../domain/labels.js";
import { ForbiddenProfileAccessError, ProfileNotFoundError } from "../domain/errors.js";
import {
  assertKnownChoice,
  validateBio,
  validateCelebration,
  validateHexColor,
  validateNickname,
  validatePlayerName,
  validateShirtNumber,
} from "../domain/validators.js";
import type { PlayerProfilePatch, PlayerRecord, PlayerRepository } from "../ports/playerRepository.js";

export interface RawProfilePatch {
  name?: string | undefined;
  nickname?: string | undefined;
  shirtNumber?: number | null | undefined;
  bio?: string | null | undefined;
  celebration?: string | null | undefined;
  primaryColor?: string | null | undefined;
  secondaryColor?: string | null | undefined;
  theme?: string | null | undefined;
  cardStyle?: string | null | undefined;
  profileFrame?: string | null | undefined;
  profileBackground?: string | null | undefined;
}

export interface UpdatePlayerProfileInput {
  /** The Discord user actually invoking the command. */
  requesterDiscordId: string;
  /** The Discord user whose profile would be modified. Only ever equal to
   * `requesterDiscordId` today (no admin/target option exists yet) — kept
   * as a separate field so the authorization check is real, not implied,
   * and doesn't silently stop working if a target option is ever added. */
  targetDiscordId: string;
  patch: RawProfilePatch;
}

export interface UpdatePlayerProfileDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
}

export async function updatePlayerProfile(
  deps: UpdatePlayerProfileDeps,
  input: UpdatePlayerProfileInput,
): Promise<PlayerRecord> {
  if (input.requesterDiscordId !== input.targetDiscordId) {
    throw new ForbiddenProfileAccessError();
  }

  const { patch } = input;
  const fieldsProvided = Object.values(patch).some((value) => value !== undefined);
  if (!fieldsProvided) {
    throw new ValidationError("Informe ao menos um campo para atualizar.");
  }

  if (patch.name !== undefined) validatePlayerName(patch.name);
  if (patch.nickname !== undefined) validateNickname(patch.nickname);
  if (patch.shirtNumber !== undefined) validateShirtNumber(patch.shirtNumber);
  if (patch.bio !== undefined) validateBio(patch.bio);
  if (patch.celebration !== undefined) validateCelebration(patch.celebration);
  validateHexColor(patch.primaryColor, "Cor principal");
  validateHexColor(patch.secondaryColor, "Cor secundária");
  assertKnownChoice(patch.theme, THEME_CHOICES, "Tema");
  assertKnownChoice(patch.cardStyle, CARD_STYLE_CHOICES, "Estilo de carta");
  assertKnownChoice(patch.profileFrame, FRAME_CHOICES, "Moldura");
  assertKnownChoice(patch.profileBackground, BACKGROUND_CHOICES, "Fundo");

  const user = await deps.userRepository.ensureUserForDiscordId(input.targetDiscordId);
  const existing = await deps.playerRepository.findByUserId(user.id);
  if (!existing) {
    throw new ProfileNotFoundError();
  }

  const normalizedPatch: PlayerProfilePatch = {};
  if (patch.name !== undefined) normalizedPatch.name = patch.name.trim();
  if (patch.nickname !== undefined) normalizedPatch.nickname = patch.nickname.trim();
  if (patch.shirtNumber !== undefined) normalizedPatch.shirtNumber = patch.shirtNumber;
  if (patch.bio !== undefined) normalizedPatch.bio = patch.bio;
  if (patch.celebration !== undefined) normalizedPatch.celebration = patch.celebration;
  if (patch.primaryColor !== undefined) normalizedPatch.primaryColor = patch.primaryColor;
  if (patch.secondaryColor !== undefined) normalizedPatch.secondaryColor = patch.secondaryColor;
  if (patch.theme !== undefined) normalizedPatch.theme = patch.theme;
  if (patch.cardStyle !== undefined) normalizedPatch.cardStyle = patch.cardStyle;
  if (patch.profileFrame !== undefined) normalizedPatch.profileFrame = patch.profileFrame;
  if (patch.profileBackground !== undefined) normalizedPatch.profileBackground = patch.profileBackground;

  return deps.playerRepository.update(user.id, normalizedPatch);
}
