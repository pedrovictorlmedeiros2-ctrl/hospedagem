// Cosmetic flavor only — cycles once every 10 seasons rather than
// growing an unbounded list. Season *numbers* (the part every query,
// unique constraint and rollover check actually relies on) are the real
// identity; this only decorates them for display.
const SEASON_EPITHETS = [
  "THE BEGINNING",
  "NEW HORIZONS",
  "RISING STARS",
  "THE COMEBACK",
  "FULL THROTTLE",
  "NO LIMITS",
  "THE RECKONING",
  "UNCHARTED",
  "THE LONG RUN",
  "LEGACY",
];

export function seasonNameFor(number: number): string {
  const epithet = SEASON_EPITHETS[(number - 1) % SEASON_EPITHETS.length];
  if (epithet === undefined) {
    throw new Error("Internal error: SEASON_EPITHETS index out of range");
  }
  return `SEASON ${String(number).padStart(2, "0")} — ${epithet}`;
}
