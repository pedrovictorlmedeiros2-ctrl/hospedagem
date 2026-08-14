import { AppError } from "../../shared/errors.js";

export class InsufficientFundsError extends AppError {
  constructor() {
    super("INSUFFICIENT_FUNDS", "Você não tem coins suficientes para isso.");
    this.name = "InsufficientFundsError";
  }
}

export class TransferCooldownError extends AppError {
  constructor(readonly daysRemaining: number) {
    super(
      "TRANSFER_COOLDOWN",
      `Você já trocou de clube recentemente. Espere mais ${Math.ceil(daysRemaining)} dia(s) para uma nova transferência.`,
    );
    this.name = "TransferCooldownError";
  }
}
