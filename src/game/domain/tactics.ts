import type { TeamStyle } from "./types.js";

/**
 * A player's halftime tactical decision for an *interactive* match (see
 * game/engine/simulateMatch.ts's simulateFirstHalf/simulateSecondHalf and
 * career/services/playCareerMatch.ts's resolveHalftimeTactic). Deliberately
 * only 3 options — this is a single decision point, not a full tactics
 * screen.
 */
export type HalftimeTacticChoice = "OFFENSIVE" | "BALANCED" | "DEFENSIVE";

export const HALFTIME_TACTIC_LABELS: Record<HalftimeTacticChoice, string> = {
  OFFENSIVE: "⚔️ Ofensivo",
  BALANCED: "⚖️ Equilibrado",
  DEFENSIVE: "🛡️ Defensivo",
};

export const HALFTIME_TACTIC_DESCRIPTIONS: Record<HalftimeTacticChoice, string> = {
  OFFENSIVE: "Mais chances de gol, mas defesa mais vulnerável.",
  BALANCED: "Sem ajuste — joga como no primeiro tempo.",
  DEFENSIVE: "Defesa mais sólida, menos chances criadas.",
};

/**
 * Maps a halftime choice onto the same `TeamStyle` mechanic that already
 * drives AI action/reaction weighting (see game/ai/decide.ts) — no new
 * simulation logic needed, just reusing an existing, already-tested
 * knob. BALANCED intentionally matches buildSquadFromProfile's existing
 * default style ("TACTICAL"), so choosing it produces a second half
 * identical to the old non-interactive simulation for the same seed.
 */
export function styleForHalftimeTactic(choice: HalftimeTacticChoice): TeamStyle {
  switch (choice) {
    case "OFFENSIVE":
      return "AGGRESSIVE";
    case "BALANCED":
      return "TACTICAL";
    case "DEFENSIVE":
      return "DEFENSIVE";
  }
}
