import type { StageType } from "@prisma/client";
import { AppError } from "../../shared/errors.js";

export class InvalidBracketSizeError extends AppError {
  constructor(size: number) {
    super("INVALID_BRACKET_SIZE", `Chave de mata-mata precisa de uma potência de 2 times (2, 4, 8, 16, 32...), recebeu ${size}.`);
    this.name = "InvalidBracketSizeError";
  }
}

const STAGE_BY_TEAM_COUNT: Record<number, StageType> = {
  32: "ROUND_OF_32",
  16: "ROUND_OF_16",
  8: "QUARTER_FINAL",
  4: "SEMI_FINAL",
  2: "FINAL",
};

export interface BracketMatch {
  homeTeamId: string;
  awayTeamId: string;
}

export interface BracketStage {
  type: StageType;
  order: number;
  matches: BracketMatch[];
}

function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

/**
 * Builds every stage of a single-elimination bracket up front, in seeded
 * order (1 vs N, 2 vs N-1, ...) — the classic seeding that keeps the
 * strongest entrants apart for as long as possible. Later stages only
 * have `homeTeamId`/`awayTeamId` filled in for the *first* stage; each
 * later stage exists as a placeholder (empty team ids get resolved by the
 * caller once the previous stage's results are known — this function is
 * pure and doesn't know any results).
 */
export function generateKnockoutBracket(teamIds: string[]): BracketStage[] {
  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error("generateKnockoutBracket: duplicate team id");
  }
  if (!isPowerOfTwo(teamIds.length)) {
    throw new InvalidBracketSizeError(teamIds.length);
  }

  const stageTypes: StageType[] = [];
  for (let size = teamIds.length; size >= 2; size /= 2) {
    const stage = STAGE_BY_TEAM_COUNT[size];
    if (!stage) throw new InvalidBracketSizeError(teamIds.length);
    stageTypes.push(stage);
  }

  const firstRoundMatches: BracketMatch[] = [];
  const half = teamIds.length / 2;
  for (let i = 0; i < half; i++) {
    const home = teamIds[i];
    const away = teamIds[teamIds.length - 1 - i];
    if (home === undefined || away === undefined) continue;
    firstRoundMatches.push({ homeTeamId: home, awayTeamId: away });
  }

  return stageTypes.map((type, index) => ({
    type,
    order: index + 1,
    matches: index === 0 ? firstRoundMatches : [],
  }));
}
