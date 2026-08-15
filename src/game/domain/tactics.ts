import type { TeamStyle } from "./types.js";

/**
 * A player's tactical decision for an *interactive* match, made at any
 * pause point (see game/engine/simulateMatch.ts's simulateFirstHalf/
 * simulateUntilMinute/simulateSecondHalf and career/services/
 * playCareerMatch.ts's resolveHalftimeTactic/resolveLateGameTactic).
 * Deliberately only 3 options — each is a single decision point, not a
 * full tactics screen.
 */
export type MatchTacticChoice = "OFFENSIVE" | "BALANCED" | "DEFENSIVE";

export const MATCH_TACTIC_LABELS: Record<MatchTacticChoice, string> = {
  OFFENSIVE: "⚔️ Ofensivo",
  BALANCED: "⚖️ Equilibrado",
  DEFENSIVE: "🛡️ Defensivo",
};

export const MATCH_TACTIC_DESCRIPTIONS: Record<MatchTacticChoice, string> = {
  OFFENSIVE: "Mais chances de gol, mas defesa mais vulnerável.",
  BALANCED: "Sem ajuste — joga como está.",
  DEFENSIVE: "Defesa mais sólida, menos chances criadas.",
};

/**
 * Maps a tactical choice onto the same `TeamStyle` mechanic that already
 * drives AI action/reaction weighting (see game/ai/decide.ts) — no new
 * simulation logic needed, just reusing an existing, already-tested
 * knob. BALANCED intentionally matches buildSquadFromProfile's existing
 * default style ("TACTICAL"), so choosing it at the very first decision
 * point produces a match identical to the old non-interactive
 * simulation for the same seed.
 */
export function styleForMatchTactic(choice: MatchTacticChoice): TeamStyle {
  switch (choice) {
    case "OFFENSIVE":
      return "AGGRESSIVE";
    case "BALANCED":
      return "TACTICAL";
    case "DEFENSIVE":
      return "DEFENSIVE";
  }
}
