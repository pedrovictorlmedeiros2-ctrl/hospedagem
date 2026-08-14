import { ValidationError } from "../../shared/errors.js";

const NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M} '.-]{1,39}$/u;
const NICKNAME_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} _-]{1,19}$/u;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Curated subset of ISO 3166-1 alpha-2 codes — deliberately NOT the full
 * catalog. We were not able to cross-check an exhaustive list against an
 * authoritative source in this environment, and asserting one from memory
 * risks silently rejecting or accepting the wrong code for an obscure
 * country. This subset covers the major footballing nations across every
 * confederation; extend it as real users request a missing country.
 */
export const KNOWN_NATIONALITIES = new Set([
  "AF", "AL", "DZ", "AR", "AM", "AU", "AT", "AZ", "BE", "BO", "BA", "BR", "BG", "CM", "CA", "CL",
  "CN", "CO", "CR", "HR", "CU", "CY", "CZ", "DK", "DO", "EC", "EG", "SV", "EE", "ET", "FI", "FR",
  "GE", "DE", "GH", "GR", "GT", "HN", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IL", "IT", "JM",
  "JP", "JO", "KZ", "KE", "KR", "KW", "LV", "LB", "LT", "LU", "MK", "MG", "MY", "ML", "MX", "MA",
  "MZ", "NL", "NZ", "NI", "NG", "NO", "PK", "PA", "PY", "PE", "PH", "PL", "PT", "QA", "RO", "RU",
  "SA", "SN", "RS", "SG", "SK", "SI", "ZA", "ES", "SE", "CH", "SY", "TH", "TN", "TR", "UA", "AE",
  "GB", "US", "UY", "VE", "VN", "ZM", "ZW", "CI", "TG", "CD", "CG", "GA", "CV",
]);

export function validatePlayerName(name: string): void {
  if (!NAME_REGEX.test(name.trim())) {
    throw new ValidationError("Nome inválido. Use de 2 a 40 letras (acentos e espaços são permitidos).");
  }
}

export function validateNickname(nickname: string): void {
  if (!NICKNAME_REGEX.test(nickname.trim())) {
    throw new ValidationError("Apelido inválido. Use de 2 a 20 caracteres (letras, números, espaço, _ ou -).");
  }
}

export function validateNationality(code: string): void {
  if (!KNOWN_NATIONALITIES.has(code)) {
    throw new ValidationError(
      `Nacionalidade inválida: "${code}". Use um código de país ISO 3166-1 alpha-2 (ex.: BR, AR, PT).`,
    );
  }
}

export function validateAge(age: number): void {
  if (!Number.isInteger(age) || age < 15 || age > 45) {
    throw new ValidationError("Idade inválida. Precisa ser um número inteiro entre 15 e 45.");
  }
}

export function validateHeightCm(heightCm: number): void {
  if (!Number.isInteger(heightCm) || heightCm < 140 || heightCm > 210) {
    throw new ValidationError("Altura inválida. Precisa ser um número inteiro entre 140 e 210 (cm).");
  }
}

export function validateShirtNumber(shirtNumber: number | null | undefined): void {
  if (shirtNumber == null) return;
  if (!Number.isInteger(shirtNumber) || shirtNumber < 1 || shirtNumber > 99) {
    throw new ValidationError("Número da camisa inválido. Precisa ser um número inteiro entre 1 e 99.");
  }
}

export function validateBio(bio: string | null | undefined): void {
  if (bio == null) return;
  if (bio.length > 140) {
    throw new ValidationError("Frase inválida. Máximo de 140 caracteres.");
  }
}

export function validateCelebration(celebration: string | null | undefined): void {
  if (celebration == null) return;
  if (celebration.length > 60) {
    throw new ValidationError("Comemoração inválida. Máximo de 60 caracteres.");
  }
}

export function validateHexColor(color: string | null | undefined, fieldLabel: string): void {
  if (color == null) return;
  if (!HEX_COLOR_REGEX.test(color)) {
    throw new ValidationError(`${fieldLabel} inválida. Use um código hexadecimal, ex.: #1E90FF.`);
  }
}

export function assertKnownChoice(
  value: string | null | undefined,
  choices: readonly string[],
  fieldLabel: string,
): void {
  if (value == null) return;
  if (!choices.includes(value)) {
    throw new ValidationError(`${fieldLabel} inválido. Opções: ${choices.join(", ")}.`);
  }
}
