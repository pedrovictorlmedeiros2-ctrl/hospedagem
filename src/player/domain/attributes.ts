import type { Position } from "@prisma/client";

export interface CoreAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface GoalkeeperAttributes {
  gkReflexes: number | null;
  gkPositioning: number | null;
  gkHandling: number | null;
  gkAerial: number | null;
  gkOneOnOne: number | null;
  gkPenalties: number | null;
}

const BASELINE = 50;

/** Every new player starts at a flat baseline — differentiation comes from training (Fase 4), not creation. */
export function calculateInitialAttributes(position: Position): CoreAttributes & GoalkeeperAttributes {
  const isGoalkeeper = position === "GK";
  return {
    pace: BASELINE,
    shooting: BASELINE,
    passing: BASELINE,
    dribbling: BASELINE,
    defending: BASELINE,
    physical: BASELINE,
    gkReflexes: isGoalkeeper ? BASELINE : null,
    gkPositioning: isGoalkeeper ? BASELINE : null,
    gkHandling: isGoalkeeper ? BASELINE : null,
    gkAerial: isGoalkeeper ? BASELINE : null,
    gkOneOnOne: isGoalkeeper ? BASELINE : null,
    gkPenalties: isGoalkeeper ? BASELINE : null,
  };
}

/**
 * Position-weighted OVR heuristic — a starting point tuned by feel, since
 * there is no real match data yet to tune it against. Revisit once the
 * Fase 3 game engine produces real performance signal. Each row's weights
 * sum to 1.
 */
const OUTFIELD_WEIGHTS: Record<Exclude<Position, "GK">, CoreAttributes> = {
  CB: { defending: 0.35, physical: 0.25, passing: 0.15, pace: 0.15, dribbling: 0.05, shooting: 0.05 },
  LB: { defending: 0.25, pace: 0.25, passing: 0.2, physical: 0.15, dribbling: 0.1, shooting: 0.05 },
  RB: { defending: 0.25, pace: 0.25, passing: 0.2, physical: 0.15, dribbling: 0.1, shooting: 0.05 },
  DM: { defending: 0.3, passing: 0.25, physical: 0.2, dribbling: 0.1, pace: 0.1, shooting: 0.05 },
  CM: { passing: 0.3, dribbling: 0.2, defending: 0.15, physical: 0.15, pace: 0.1, shooting: 0.1 },
  AM: { passing: 0.25, dribbling: 0.25, shooting: 0.2, pace: 0.15, physical: 0.1, defending: 0.05 },
  LM: { pace: 0.25, dribbling: 0.25, passing: 0.2, shooting: 0.15, physical: 0.1, defending: 0.05 },
  RM: { pace: 0.25, dribbling: 0.25, passing: 0.2, shooting: 0.15, physical: 0.1, defending: 0.05 },
  LW: { pace: 0.3, dribbling: 0.25, shooting: 0.25, passing: 0.1, physical: 0.05, defending: 0.05 },
  RW: { pace: 0.3, dribbling: 0.25, shooting: 0.25, passing: 0.1, physical: 0.05, defending: 0.05 },
  ST: { shooting: 0.35, pace: 0.25, dribbling: 0.2, passing: 0.1, physical: 0.06, defending: 0.04 },
};

export function calculateOverall(position: Position, attrs: CoreAttributes & GoalkeeperAttributes): number {
  if (position === "GK") {
    const known = [attrs.gkReflexes, attrs.gkPositioning, attrs.gkHandling, attrs.gkAerial, attrs.gkOneOnOne, attrs.gkPenalties].filter(
      (value): value is number => value !== null,
    );
    if (known.length === 0) return 0;
    return Math.round(known.reduce((sum, value) => sum + value, 0) / known.length);
  }

  const weights = OUTFIELD_WEIGHTS[position];
  const weighted =
    attrs.pace * weights.pace +
    attrs.shooting * weights.shooting +
    attrs.passing * weights.passing +
    attrs.dribbling * weights.dribbling +
    attrs.defending * weights.defending +
    attrs.physical * weights.physical;
  return Math.round(weighted);
}
