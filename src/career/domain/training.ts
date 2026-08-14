import type { Position } from "@prisma/client";
import { ValidationError } from "../../shared/errors.js";
import type { CoreAttributes, GoalkeeperAttributes } from "../../player/domain/attributes.js";

/** Only the twelve trainable ability fields — deliberately narrower than PlayerAttributesPatch (which also has overall/form/stamina, which training never targets directly). */
export type TrainableAttributeField = keyof (CoreAttributes & GoalkeeperAttributes);

export type TrainingFocus =
  | "PACE"
  | "SHOOTING"
  | "PASSING"
  | "DRIBBLING"
  | "DEFENDING"
  | "PHYSICAL"
  | "GK_REFLEXES"
  | "GK_POSITIONING"
  | "GK_HANDLING"
  | "GK_AERIAL"
  | "GK_ONE_ON_ONE"
  | "GK_PENALTIES";

export const OUTFIELD_FOCUSES: TrainingFocus[] = [
  "PACE",
  "SHOOTING",
  "PASSING",
  "DRIBBLING",
  "DEFENDING",
  "PHYSICAL",
];
export const GOALKEEPER_FOCUSES: TrainingFocus[] = [
  "GK_REFLEXES",
  "GK_POSITIONING",
  "GK_HANDLING",
  "GK_AERIAL",
  "GK_ONE_ON_ONE",
  "GK_PENALTIES",
];

export const TRAINING_FOCUS_LABELS: Record<TrainingFocus, string> = {
  PACE: "Ritmo",
  SHOOTING: "Finalização",
  PASSING: "Passe",
  DRIBBLING: "Drible",
  DEFENDING: "Marcação",
  PHYSICAL: "Físico",
  GK_REFLEXES: "Reflexo",
  GK_POSITIONING: "Posicionamento",
  GK_HANDLING: "Segurança de bola",
  GK_AERIAL: "Jogo aéreo",
  GK_ONE_ON_ONE: "Um contra um",
  GK_PENALTIES: "Pênaltis",
};

const ATTRIBUTE_FIELD: Record<TrainingFocus, TrainableAttributeField> = {
  PACE: "pace",
  SHOOTING: "shooting",
  PASSING: "passing",
  DRIBBLING: "dribbling",
  DEFENDING: "defending",
  PHYSICAL: "physical",
  GK_REFLEXES: "gkReflexes",
  GK_POSITIONING: "gkPositioning",
  GK_HANDLING: "gkHandling",
  GK_AERIAL: "gkAerial",
  GK_ONE_ON_ONE: "gkOneOnOne",
  GK_PENALTIES: "gkPenalties",
};

export function focusesForPosition(position: Position): TrainingFocus[] {
  return position === "GK" ? GOALKEEPER_FOCUSES : OUTFIELD_FOCUSES;
}

export function validateFocusForPosition(focus: TrainingFocus, position: Position): void {
  if (!focusesForPosition(position).includes(focus)) {
    const options = focusesForPosition(position)
      .map((option) => TRAINING_FOCUS_LABELS[option])
      .join(", ");
    throw new ValidationError(`Foco de treino inválido para a sua posição. Opções: ${options}.`);
  }
}

export function attributeFieldFor(focus: TrainingFocus): TrainableAttributeField {
  return ATTRIBUTE_FIELD[focus];
}

const BASE_GAIN = 3;
const MAX_ATTRIBUTE = 99;

/** Diminishing returns: the closer an attribute is to the 99 cap, the smaller the gain — but never zero below the cap, so training always feels worthwhile. */
export function calculateTrainingGain(currentValue: number): number {
  if (currentValue >= MAX_ATTRIBUTE) return 0;
  const raw = BASE_GAIN * (1 - currentValue / 100);
  return Math.max(1, Math.round(raw));
}

export const TRAINING_STAMINA_COST = 10;
export const MIN_STAMINA_TO_TRAIN = 15;
export const TRAINING_COOLDOWN_HOURS = 20;

/** Cooldown is hours-based (not a calendar-date string match) so it's trivially testable with fixed Date objects, while still landing on "about once per real day". */
export function canTrainNow(lastTrainingAt: Date | null, now: Date): boolean {
  if (!lastTrainingAt) return true;
  const hoursSince = (now.getTime() - lastTrainingAt.getTime()) / (1000 * 60 * 60);
  return hoursSince >= TRAINING_COOLDOWN_HOURS;
}
