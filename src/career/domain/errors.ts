import { AppError } from "../../shared/errors.js";

export class TrainingCooldownError extends AppError {
  constructor(readonly hoursRemaining: number) {
    super(
      "TRAINING_COOLDOWN",
      `Seu jogador já treinou hoje. Volta em cerca de ${Math.ceil(hoursRemaining)}h para o próximo treino.`,
    );
    this.name = "TrainingCooldownError";
  }
}

export class InsufficientStaminaError extends AppError {
  constructor() {
    super(
      "INSUFFICIENT_STAMINA",
      "Estamina baixa demais para treinar agora. Descanse e tente de novo mais tarde.",
    );
    this.name = "InsufficientStaminaError";
  }
}
