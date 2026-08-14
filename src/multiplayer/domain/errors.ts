import { AppError } from "../../shared/errors.js";

export class DuelNotPendingError extends AppError {
  constructor() {
    super("DUEL_NOT_PENDING", "Esse duelo não está mais pendente — já foi respondido ou cancelado.");
    this.name = "DuelNotPendingError";
  }
}
