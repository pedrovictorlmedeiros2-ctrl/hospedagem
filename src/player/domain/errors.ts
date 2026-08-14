import { AppError } from "../../shared/errors.js";

export class DuplicateProfileError extends AppError {
  constructor(readonly internalUserId: string) {
    super(
      "DUPLICATE_PROFILE",
      "Você já tem um perfil de jogador criado. Use /personalizar para editá-lo.",
    );
    this.name = "DuplicateProfileError";
  }
}

export class ProfileNotFoundError extends AppError {
  constructor() {
    super("PROFILE_NOT_FOUND", "Você ainda não tem um perfil. Use /criar-perfil primeiro.");
    this.name = "ProfileNotFoundError";
  }
}

export class ForbiddenProfileAccessError extends AppError {
  constructor() {
    super("FORBIDDEN_PROFILE_ACCESS", "Você só pode editar o seu próprio perfil.");
    this.name = "ForbiddenProfileAccessError";
  }
}
