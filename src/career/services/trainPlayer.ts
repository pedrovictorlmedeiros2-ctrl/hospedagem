import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ProfileNotFoundError } from "../../player/domain/errors.js";
import type { PlayerRecord, PlayerRepository } from "../../player/ports/playerRepository.js";
import {
  calculateOverall,
  type CoreAttributes,
  type GoalkeeperAttributes,
} from "../../player/domain/attributes.js";
import { InsufficientStaminaError, TrainingCooldownError } from "../domain/errors.js";
import {
  attributeFieldFor,
  calculateTrainingGain,
  canTrainNow,
  MIN_STAMINA_TO_TRAIN,
  TRAINING_COOLDOWN_HOURS,
  TRAINING_STAMINA_COST,
  validateFocusForPosition,
  type TrainingFocus,
} from "../domain/training.js";
import type { TrainingRepository } from "../ports/trainingRepository.js";

export interface TrainPlayerDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  trainingRepository: TrainingRepository;
}

export interface TrainPlayerInput {
  discordId: string;
  focus: TrainingFocus;
  now?: Date;
}

export interface TrainPlayerOutput {
  player: PlayerRecord;
  focus: TrainingFocus;
  gainedPoints: number;
}

function currentAttributes(player: PlayerRecord): CoreAttributes & GoalkeeperAttributes {
  return {
    pace: player.pace,
    shooting: player.shooting,
    passing: player.passing,
    dribbling: player.dribbling,
    defending: player.defending,
    physical: player.physical,
    gkReflexes: player.gkReflexes,
    gkPositioning: player.gkPositioning,
    gkHandling: player.gkHandling,
    gkAerial: player.gkAerial,
    gkOneOnOne: player.gkOneOnOne,
    gkPenalties: player.gkPenalties,
  };
}

export async function trainPlayer(
  deps: TrainPlayerDeps,
  input: TrainPlayerInput,
): Promise<TrainPlayerOutput> {
  const now = input.now ?? new Date();

  const user = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const player = await deps.playerRepository.findByUserId(user.id);
  if (!player) {
    throw new ProfileNotFoundError();
  }

  validateFocusForPosition(input.focus, player.position);

  const lastTrainingAt = await deps.trainingRepository.getLastTrainingAt(player.id);
  if (!canTrainNow(lastTrainingAt, now)) {
    const elapsedHours = lastTrainingAt
      ? (now.getTime() - lastTrainingAt.getTime()) / (1000 * 60 * 60)
      : 0;
    throw new TrainingCooldownError(TRAINING_COOLDOWN_HOURS - elapsedHours);
  }

  if (player.stamina < MIN_STAMINA_TO_TRAIN) {
    throw new InsufficientStaminaError();
  }

  const field = attributeFieldFor(input.focus);
  const attributes = currentAttributes(player);
  const currentValue = attributes[field] ?? 0;
  const gain = calculateTrainingGain(currentValue);
  const newValue = Math.min(99, currentValue + gain);

  const updatedAttributes = { ...attributes, [field]: newValue };
  const newOverall = calculateOverall(player.position, updatedAttributes);
  const newStamina = Math.max(0, player.stamina - TRAINING_STAMINA_COST);

  const updatedPlayer = await deps.playerRepository.updateAttributes(user.id, {
    [field]: newValue,
    overall: newOverall,
    stamina: newStamina,
  });

  await deps.trainingRepository.recordTraining({
    playerId: player.id,
    focus: input.focus,
    gainedAttributePoints: gain,
    staminaCost: TRAINING_STAMINA_COST,
    performedAt: now,
  });

  return { player: updatedPlayer, focus: input.focus, gainedPoints: gain };
}
