import type { WalletRepository } from "../../economy/ports/walletRepository.js";
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
  INTENSIVE_TRAINING_COST_COINS,
  INTENSIVE_TRAINING_MULTIPLIER,
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
  walletRepository: WalletRepository;
}

export interface TrainPlayerInput {
  discordId: string;
  focus: TrainingFocus;
  /** Paid upgrade — doubles the gain for this same session, costs INTENSIVE_TRAINING_COST_COINS. Throws InsufficientFundsError if the wallet can't cover it. */
  intensive?: boolean;
  now?: Date;
}

export interface TrainPlayerOutput {
  player: PlayerRecord;
  focus: TrainingFocus;
  gainedPoints: number;
  intensive: boolean;
  coinsSpent: number;
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

  const intensive = input.intensive ?? false;
  if (intensive) {
    // Bucketed by UTC calendar day rather than a fresh key per call: two
    // concurrent/retried requests for the same intensive session on the
    // same day resolve to the same idempotencyKey, so the wallet charges
    // exactly once (see WalletRepository.applyTransaction) even though the
    // cooldown check above hasn't recorded this session yet.
    const dayBucket = now.toISOString().slice(0, 10);
    await deps.walletRepository.applyTransaction({
      userId: user.id,
      currency: "COINS",
      type: "SINK",
      amount: BigInt(INTENSIVE_TRAINING_COST_COINS),
      reason: "INTENSIVE_TRAINING",
      idempotencyKey: `training-intensive:${player.id}:${dayBucket}`,
    });
  }

  const field = attributeFieldFor(input.focus);
  const attributes = currentAttributes(player);
  const currentValue = attributes[field] ?? 0;
  const gain = calculateTrainingGain(currentValue) * (intensive ? INTENSIVE_TRAINING_MULTIPLIER : 1);
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

  return {
    player: updatedPlayer,
    focus: input.focus,
    gainedPoints: gain,
    intensive,
    coinsSpent: intensive ? INTENSIVE_TRAINING_COST_COINS : 0,
  };
}
