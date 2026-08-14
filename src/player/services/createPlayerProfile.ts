import type { PlayStyle, Position, PreferredFoot } from "@prisma/client";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import { calculateInitialAttributes, calculateOverall, STARTING_GLOBAL_RATING } from "../domain/attributes.js";
import { DuplicateProfileError } from "../domain/errors.js";
import {
  validateAge,
  validateHeightCm,
  validateNationality,
  validateNickname,
  validatePlayerName,
  validateShirtNumber,
} from "../domain/validators.js";
import type { PlayerRecord, PlayerRepository } from "../ports/playerRepository.js";

export interface CreatePlayerProfileInput {
  discordId: string;
  name: string;
  nickname: string;
  nationality: string;
  age: number;
  position: Position;
  preferredFoot: PreferredFoot;
  heightCm: number;
  playStyle: PlayStyle;
  shirtNumber: number | null;
}

export interface CreatePlayerProfileDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
}

function ageToBirthDate(age: number, now = new Date()): Date {
  const birthDate = new Date(now);
  birthDate.setUTCFullYear(birthDate.getUTCFullYear() - age);
  return birthDate;
}

export async function createPlayerProfile(
  deps: CreatePlayerProfileDeps,
  input: CreatePlayerProfileInput,
): Promise<PlayerRecord> {
  validatePlayerName(input.name);
  validateNickname(input.nickname);
  validateNationality(input.nationality);
  validateAge(input.age);
  validateHeightCm(input.heightCm);
  validateShirtNumber(input.shirtNumber);

  const user = await deps.userRepository.ensureUserForDiscordId(input.discordId);

  // Friendlier error message for the common (non-racing) case. The
  // repository's `create` below is the actual concurrency guard — see
  // PlayerRepository's doc comment.
  const existing = await deps.playerRepository.findByUserId(user.id);
  if (existing) {
    throw new DuplicateProfileError(user.id);
  }

  const attributes = calculateInitialAttributes(input.position);
  const overall = calculateOverall(input.position, attributes);

  return deps.playerRepository.create({
    userId: user.id,
    name: input.name.trim(),
    nickname: input.nickname.trim(),
    nationality: input.nationality,
    birthDate: ageToBirthDate(input.age),
    position: input.position,
    preferredFoot: input.preferredFoot,
    heightCm: input.heightCm,
    playStyle: input.playStyle,
    shirtNumber: input.shirtNumber,
    ...attributes,
    overall,
    globalRating: STARTING_GLOBAL_RATING,
  });
}
