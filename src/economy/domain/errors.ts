import { AppError } from "../../shared/errors.js";

export class InsufficientFundsError extends AppError {
  constructor() {
    super("INSUFFICIENT_FUNDS", "Você não tem coins suficientes para isso.");
    this.name = "InsufficientFundsError";
  }
}
