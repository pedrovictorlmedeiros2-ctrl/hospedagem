import type { AttackAction, DefenseReaction, TeamStyle } from "../domain/types.js";
import type { Rng } from "../domain/rng.js";
import { weightedPick } from "../domain/rng.js";
import type { AIState } from "./aiState.js";

/**
 * The "Contexto" step of the perception → contexto → estado → decisão →
 * ação pipeline the product spec asks for. `perceive.ts` builds this from
 * the raw MatchSimState; decide.ts only ever sees this summarized shape —
 * it has no idea what a "zone" or a "side" is, which keeps the decision
 * weighting logic testable in isolation from match bookkeeping.
 */
export interface DecisionContext {
  minute: number;
  /** 0 = attacking team is deep in its own half, 1 = right in front of the opposing goal. */
  attackerProgress: number;
  /** attackingTeam score - defendingTeam score. */
  scoreDiff: number;
  attackerStamina: number;
  defenderStamina: number;
  timeRemaining: number;
}

const ATTACK_STATE_BY_ACTION: Record<AttackAction, AIState> = {
  HOLD: "ATTACKING",
  PASS: "PASSING",
  CROSS: "PASSING",
  DRIBBLE: "DRIBBLING",
  SHOOT: "SHOOTING",
};

const DEFENSE_STATE_BY_REACTION: Record<DefenseReaction, AIState> = {
  DEFEND: "DEFENDING",
  PRESS: "PRESSING",
  RECOVER: "RECOVERING",
};

const ATTACK_STYLE_MULTIPLIERS: Record<TeamStyle, Partial<Record<AttackAction, number>>> = {
  DEFENSIVE: { HOLD: 1.5, PASS: 1.3, DRIBBLE: 0.6, SHOOT: 0.6, CROSS: 0.6 },
  AGGRESSIVE: { DRIBBLE: 1.4, SHOOT: 1.4, HOLD: 0.5 },
  POSSESSION: { PASS: 1.6, HOLD: 1.2, DRIBBLE: 0.8, SHOOT: 0.8 },
  COUNTER_ATTACK: { DRIBBLE: 1.3, SHOOT: 1.2, PASS: 0.9, HOLD: 0.5 },
  DRIBBLING: { DRIBBLE: 1.8, CROSS: 1.2 },
  TACTICAL: { PASS: 1.2, CROSS: 1.1 },
};

const DEFENSE_STYLE_MULTIPLIERS: Record<TeamStyle, Partial<Record<DefenseReaction, number>>> = {
  DEFENSIVE: { DEFEND: 1.5, PRESS: 0.6 },
  AGGRESSIVE: { PRESS: 1.8, DEFEND: 0.7 },
  POSSESSION: { DEFEND: 1.2 },
  COUNTER_ATTACK: { DEFEND: 1.3, PRESS: 0.7 },
  DRIBBLING: {},
  TACTICAL: { DEFEND: 1.1 },
};

const MIN_WEIGHT = 0.5;

export function decideAttackAction(
  context: DecisionContext,
  style: TeamStyle,
  rng: Rng,
): { state: AIState; action: AttackAction } {
  const weights: Record<AttackAction, number> = {
    HOLD: 15,
    PASS: 40,
    DRIBBLE: 20,
    SHOOT: context.attackerProgress > 0.75 ? 25 : context.attackerProgress > 0.5 ? 8 : 1,
    CROSS: context.attackerProgress > 0.6 ? 15 : 2,
  };

  const styleMultipliers = ATTACK_STYLE_MULTIPLIERS[style];
  for (const [action, multiplier] of Object.entries(styleMultipliers) as [AttackAction, number][]) {
    weights[action] *= multiplier;
  }

  if (context.attackerStamina < 40) {
    weights.DRIBBLE *= 0.6;
    weights.PASS *= 1.2;
  }

  const losingLate = context.scoreDiff < 0 && context.timeRemaining < 20;
  if (losingLate) {
    weights.SHOOT *= 1.5;
    weights.DRIBBLE *= 1.3;
    weights.HOLD *= 0.3;
  }

  const winningLate = context.scoreDiff > 0 && context.timeRemaining < 15;
  if (winningLate) {
    weights.HOLD *= 2.5;
    weights.PASS *= 1.3;
    weights.SHOOT *= 0.5;
  }

  const entries = (Object.entries(weights) as [AttackAction, number][]).map(
    ([action, weight]) => [action, Math.max(MIN_WEIGHT, weight)] as const,
  );
  const action = weightedPick(rng, entries);

  return { state: ATTACK_STATE_BY_ACTION[action], action };
}

export function decideDefenseReaction(
  context: DecisionContext,
  style: TeamStyle,
  rng: Rng,
): { state: AIState; reaction: DefenseReaction } {
  const weights: Record<DefenseReaction, number> = { DEFEND: 50, PRESS: 30, RECOVER: 20 };

  const styleMultipliers = DEFENSE_STYLE_MULTIPLIERS[style];
  for (const [reaction, multiplier] of Object.entries(styleMultipliers) as [DefenseReaction, number][]) {
    weights[reaction] *= multiplier;
  }

  if (context.defenderStamina < 40) {
    weights.PRESS *= 0.4;
    weights.RECOVER *= 1.8;
  }

  const entries = (Object.entries(weights) as [DefenseReaction, number][]).map(
    ([reaction, weight]) => [reaction, Math.max(MIN_WEIGHT, weight)] as const,
  );
  const reaction = weightedPick(rng, entries);

  return { state: DEFENSE_STATE_BY_REACTION[reaction], reaction };
}
