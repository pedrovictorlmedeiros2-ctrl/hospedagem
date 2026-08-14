import type { Rng } from "../domain/rng.js";
import { rollContest } from "../domain/rng.js";
import type { TeamRuntimeState } from "../domain/state.js";
import type { AttackAction, DefenseReaction, MatchPlayerInput } from "../domain/types.js";
import {
  getGoalkeeper,
  gkRating,
  pickAttacker,
  pickDefender,
  pickDribbler,
  pickPasser,
} from "./players.js";

export type ActionOutcomeKind =
  | "ADVANCE"
  | "STALL"
  | "TURNOVER"
  | "GOAL"
  | "SAVED"
  | "OFF_TARGET"
  | "BLOCKED_FOR_CORNER"
  | "FOUL"
  | "OFFSIDE";

export interface ActionOutcome {
  kind: ActionOutcomeKind;
  /** +1 toward the attacking side's target goal, 0 = no change. Engine translates this to an absolute zone move. */
  zoneDelta: 0 | 1;
  primaryPlayer?: MatchPlayerInput | undefined;
  assistPlayer?: MatchPlayerInput | undefined;
  gk?: MatchPlayerInput | null | undefined;
  tacklePlayer?: MatchPlayerInput | undefined;
  isPenalty?: boolean | undefined;
  card?: "YELLOW" | "RED" | undefined;
  cardPlayer?: MatchPlayerInput | undefined;
  injuredPlayer?: MatchPlayerInput | undefined;
}

function intensityFor(reaction: DefenseReaction): number {
  if (reaction === "PRESS") return 1.25;
  if (reaction === "RECOVER") return 0.7;
  return 1.0;
}

function buildFoulOutcome(
  defender: MatchPlayerInput,
  victim: MatchPlayerInput,
  isInDefendingBox: boolean,
  rng: Rng,
): ActionOutcome {
  let card: "YELLOW" | "RED" | undefined;
  if (rng() < 0.25) card = "YELLOW";
  if (card === "YELLOW" && rng() < 0.08) card = "RED";

  const injuredPlayer = rng() < 0.05 ? victim : undefined;

  return {
    kind: "FOUL",
    zoneDelta: 0,
    primaryPlayer: victim,
    tacklePlayer: defender,
    isPenalty: isInDefendingBox,
    card,
    cardPlayer: card ? defender : undefined,
    injuredPlayer,
  };
}

function resolveShot(
  attackingTeam: TeamRuntimeState,
  defendingTeam: TeamRuntimeState,
  rng: Rng,
): ActionOutcome {
  const shooter = pickAttacker(attackingTeam, rng);
  const gk = getGoalkeeper(defendingTeam);

  const onTargetChance = Math.min(0.85, Math.max(0.15, 0.35 + (shooter.shooting - 50) / 200));
  if (rng() >= onTargetChance) {
    if (rng() < 0.35) return { kind: "BLOCKED_FOR_CORNER", zoneDelta: 0, primaryPlayer: shooter };
    return { kind: "OFF_TARGET", zoneDelta: 0, primaryPlayer: shooter };
  }

  const shotQuality = shooter.shooting * 0.7 + shooter.overall * 0.3;
  const scored = rollContest(rng, shotQuality, gkRating(gk) * 1.15);
  return scored
    ? { kind: "GOAL", zoneDelta: 0, primaryPlayer: shooter, gk }
    : { kind: "SAVED", zoneDelta: 0, primaryPlayer: shooter, gk };
}

function resolveCross(
  attackingTeam: TeamRuntimeState,
  defendingTeam: TeamRuntimeState,
  rng: Rng,
): ActionOutcome {
  const crosser = pickPasser(attackingTeam, rng);
  const defender = pickDefender(defendingTeam, rng);

  const delivered = rollContest(rng, crosser.passing, defender.defending * 1.1);
  if (!delivered) {
    if (rng() < 0.2) return { kind: "BLOCKED_FOR_CORNER", zoneDelta: 0, primaryPlayer: crosser };
    return { kind: "TURNOVER", zoneDelta: 0, primaryPlayer: crosser, tacklePlayer: defender };
  }

  if (rng() < 0.08) return { kind: "OFFSIDE", zoneDelta: 0, primaryPlayer: crosser };

  const shooter = pickAttacker(attackingTeam, rng);
  const gk = getGoalkeeper(defendingTeam);
  if (rng() >= 0.6) return { kind: "OFF_TARGET", zoneDelta: 0, primaryPlayer: shooter };

  const shotQuality = shooter.shooting * 0.6 + shooter.overall * 0.2 + crosser.passing * 0.2;
  const scored = rollContest(rng, shotQuality, gkRating(gk) * 1.15);
  return scored
    ? { kind: "GOAL", zoneDelta: 0, primaryPlayer: shooter, assistPlayer: crosser, gk }
    : { kind: "SAVED", zoneDelta: 0, primaryPlayer: shooter, gk };
}

function resolveDribble(
  attackingTeam: TeamRuntimeState,
  defendingTeam: TeamRuntimeState,
  defenseReaction: DefenseReaction,
  patternBonus: number,
  isInDefendingBox: boolean,
  rng: Rng,
): ActionOutcome {
  const dribbler = pickDribbler(attackingTeam, rng);
  const defender = pickDefender(defendingTeam, rng);

  const defenderRating = defender.defending * intensityFor(defenseReaction) + patternBonus;
  if (rollContest(rng, dribbler.dribbling, defenderRating)) {
    return { kind: "ADVANCE", zoneDelta: 1, primaryPlayer: dribbler };
  }

  const foulChance = defenseReaction === "PRESS" ? 0.22 : 0.12;
  if (rng() < foulChance) return buildFoulOutcome(defender, dribbler, isInDefendingBox, rng);

  return { kind: "TURNOVER", zoneDelta: 0, primaryPlayer: dribbler, tacklePlayer: defender };
}

function resolvePass(
  attackingTeam: TeamRuntimeState,
  defendingTeam: TeamRuntimeState,
  defenseReaction: DefenseReaction,
  patternBonus: number,
  isInDefendingBox: boolean,
  rng: Rng,
): ActionOutcome {
  const passer = pickPasser(attackingTeam, rng);
  const defender = pickDefender(defendingTeam, rng);

  const defenderRating = defender.defending * intensityFor(defenseReaction) * 0.8 + patternBonus;
  if (rollContest(rng, passer.passing, defenderRating)) {
    return {
      kind: rng() < 0.4 ? "ADVANCE" : "STALL",
      zoneDelta: rng() < 0.4 ? 1 : 0,
      primaryPlayer: passer,
    };
  }

  const foulChance = defenseReaction === "PRESS" ? 0.1 : 0.04;
  if (rng() < foulChance) return buildFoulOutcome(defender, passer, isInDefendingBox, rng);

  return { kind: "TURNOVER", zoneDelta: 0, primaryPlayer: passer, tacklePlayer: defender };
}

function resolveHold(defenseReaction: DefenseReaction, rng: Rng): ActionOutcome {
  const turnoverChance =
    defenseReaction === "PRESS" ? 0.15 : defenseReaction === "DEFEND" ? 0.05 : 0.02;
  if (rng() < turnoverChance) return { kind: "TURNOVER", zoneDelta: 0 };
  return { kind: "STALL", zoneDelta: 0 };
}

export function resolveAction(
  action: AttackAction,
  attackingTeam: TeamRuntimeState,
  defendingTeam: TeamRuntimeState,
  defenseReaction: DefenseReaction,
  patternBonus: number,
  isInDefendingBox: boolean,
  rng: Rng,
): ActionOutcome {
  switch (action) {
    case "SHOOT":
      return resolveShot(attackingTeam, defendingTeam, rng);
    case "CROSS":
      return resolveCross(attackingTeam, defendingTeam, rng);
    case "DRIBBLE":
      return resolveDribble(
        attackingTeam,
        defendingTeam,
        defenseReaction,
        patternBonus,
        isInDefendingBox,
        rng,
      );
    case "PASS":
      return resolvePass(
        attackingTeam,
        defendingTeam,
        defenseReaction,
        patternBonus,
        isInDefendingBox,
        rng,
      );
    case "HOLD":
      return resolveHold(defenseReaction, rng);
  }
}

export function resolvePenalty(
  shooter: MatchPlayerInput,
  gk: MatchPlayerInput | null,
  rng: Rng,
): "SCORED" | "MISSED" {
  const takerQuality = shooter.shooting * 0.8 + shooter.overall * 0.2;
  const gkPenaltyRating = gk?.gkPenalties ?? gkRating(gk);
  return rollContest(rng, takerQuality, gkPenaltyRating * 0.9) ? "SCORED" : "MISSED";
}
