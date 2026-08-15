const FILLED = "▰";
const EMPTY = "▱";

/**
 * Renders a fixed-width unicode block bar (e.g. "▰▰▰▰▰▰▰▱▱▱") for any
 * 0..max metric — attributes, stamina, season progress. Discord has no
 * native progress-bar component, so this is the cheapest way to give the
 * text-only Components V2 cards a visual read at a glance instead of a
 * bare number.
 */
export function progressBar(value: number, max: number, length = 10): string {
  if (max <= 0) return EMPTY.repeat(length);
  const clamped = Math.max(0, Math.min(max, value));
  const filled = Math.round((clamped / max) * length);
  return FILLED.repeat(filled) + EMPTY.repeat(length - filled);
}

/** Same bar, with the raw "value/max" suffix — the common case for attribute/stamina rows. */
export function progressBarWithValue(value: number, max: number, length = 10): string {
  return `${progressBar(value, max, length)} ${value}/${max}`;
}
