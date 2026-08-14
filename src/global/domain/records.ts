/**
 * `Record.category` is a raw String in the schema (not a DB enum) — kept
 * as a typed union here so every write/read in this codebase agrees on
 * the exact set of valid values, without needing a migration to add a
 * new category later.
 */
export type RecordCategory = "HIGHEST_GLOBAL_RATING" | "MOST_GOALS_SEASON";

export const ALL_RECORD_CATEGORIES: RecordCategory[] = ["HIGHEST_GLOBAL_RATING", "MOST_GOALS_SEASON"];

export const RECORD_CATEGORY_LABELS: Record<RecordCategory, string> = {
  HIGHEST_GLOBAL_RATING: "Maior rating global",
  MOST_GOALS_SEASON: "Mais gols em uma temporada",
};

export interface CurrentRecordLike {
  holderPlayerId: string;
  value: number;
}

/** A new record is set only by strictly beating the current one — matching it isn't enough (first to reach a value keeps the record). */
export function isNewRecord(current: CurrentRecordLike | null, candidateValue: number): boolean {
  return current === null || candidateValue > current.value;
}
