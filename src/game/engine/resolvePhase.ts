import { decideAttackAction, decideDefenseReaction } from "../ai/decide.js";
import { perceive } from "../ai/perceive.js";
import { patternReadBonus, recordAction } from "../ai/pattern.js";
import type { Rng } from "../domain/rng.js";
import type { MatchSimState } from "../domain/state.js";
import { AWAY_BOX, AWAY_THIRD, HOME_BOX, HOME_THIRD, MIDFIELD, type PitchZone, type Side, type SimMatchEvent } from "../domain/types.js";
import { getGoalkeeper } from "./players.js";
import { type ActionOutcome, resolveAction, resolvePenalty } from "./resolveAction.js";
import { drainStamina } from "./stamina.js";
import { maybeSubstituteTired, sendOff, substituteInjured } from "./substitution.js";

function oppositeSide(side: Side): Side {
  return side === "home" ? "away" : "home";
}

function direction(side: Side): 1 | -1 {
  return side === "home" ? 1 : -1;
}

function clampZone(zone: number): PitchZone {
  return Math.min(4, Math.max(0, zone)) as PitchZone;
}

function ownThirdOf(side: Side): PitchZone {
  return side === "home" ? HOME_THIRD : AWAY_THIRD;
}

function isDefendingBoxFor(side: Side, zone: PitchZone): boolean {
  return side === "home" ? zone === AWAY_BOX : zone === HOME_BOX;
}

function applyOutcome(
  state: MatchSimState,
  attackingSide: Side,
  outcome: ActionOutcome,
  minute: number,
  events: SimMatchEvent[],
  rng: Rng,
): void {
  const defendingSide = oppositeSide(attackingSide);
  const attackingTeam = state[attackingSide];
  const defendingTeam = state[defendingSide];

  switch (outcome.kind) {
    case "ADVANCE": {
      state.zone = clampZone(state.zone + direction(attackingSide) * outcome.zoneDelta);
      break;
    }
    case "STALL": {
      break;
    }
    case "TURNOVER": {
      state.possession = defendingSide;
      break;
    }
    case "GOAL": {
      if (attackingSide === "home") state.homeScore += 1;
      else state.awayScore += 1;

      if (outcome.primaryPlayer) {
        const scorerStats = attackingTeam.stats.get(outcome.primaryPlayer.id);
        if (scorerStats) scorerStats.goals += 1;
      }
      if (outcome.assistPlayer) {
        const assistStats = attackingTeam.stats.get(outcome.assistPlayer.id);
        if (assistStats) assistStats.assists += 1;
      }

      events.push({
        minute,
        type: "GOAL",
        side: attackingSide,
        playerId: outcome.primaryPlayer?.id ?? null,
        ...(outcome.assistPlayer ? { metadata: { assistPlayerId: outcome.assistPlayer.id } } : {}),
      });

      state.zone = MIDFIELD;
      state.possession = defendingSide;
      break;
    }
    case "SAVED": {
      if (outcome.gk) {
        const gkStats = defendingTeam.stats.get(outcome.gk.id);
        if (gkStats) gkStats.saves += 1;
      }
      state.zone = ownThirdOf(defendingSide);
      state.possession = defendingSide;
      break;
    }
    case "OFF_TARGET": {
      state.zone = ownThirdOf(defendingSide);
      state.possession = defendingSide;
      break;
    }
    case "BLOCKED_FOR_CORNER": {
      events.push({ minute, type: "CORNER", side: attackingSide, playerId: outcome.primaryPlayer?.id ?? null });
      break;
    }
    case "OFFSIDE": {
      events.push({ minute, type: "OFFSIDE", side: attackingSide, playerId: outcome.primaryPlayer?.id ?? null });
      state.zone = ownThirdOf(defendingSide);
      state.possession = defendingSide;
      break;
    }
    case "FOUL": {
      if (outcome.tacklePlayer) {
        const tackleStats = defendingTeam.stats.get(outcome.tacklePlayer.id);
        if (tackleStats) tackleStats.tackles += 1;
      }

      if (outcome.card && outcome.cardPlayer) {
        const cardPlayerId = outcome.cardPlayer.id;
        const cardStats = defendingTeam.stats.get(cardPlayerId);
        if (cardStats && outcome.card === "YELLOW") cardStats.yellowCards += 1;

        events.push({ minute, type: outcome.card === "YELLOW" ? "YELLOW_CARD" : "RED_CARD", side: defendingSide, playerId: cardPlayerId });

        const isSecondYellow = outcome.card === "YELLOW" && (cardStats?.yellowCards ?? 0) >= 2;
        if (outcome.card === "RED" || isSecondYellow) {
          if (cardStats) cardStats.redCarded = true;
          sendOff(defendingTeam, cardPlayerId);
          if (isSecondYellow) {
            events.push({ minute, type: "RED_CARD", side: defendingSide, playerId: cardPlayerId, metadata: { secondYellow: true } });
          }
        }
      }

      if (outcome.injuredPlayer) {
        const injuredId = outcome.injuredPlayer.id;
        events.push({ minute, type: "INJURY", side: attackingSide, playerId: injuredId });
        const sub = substituteInjured(attackingTeam, injuredId);
        if (sub) {
          events.push({
            minute,
            type: "SUBSTITUTION",
            side: attackingSide,
            playerId: sub.inPlayerId,
            metadata: { outPlayerId: sub.outPlayerId, reason: "injury" },
          });
        }
      }

      if (outcome.isPenalty && outcome.primaryPlayer) {
        const taker = outcome.primaryPlayer;
        const gk = getGoalkeeper(defendingTeam);
        const result = resolvePenalty(taker, gk, rng);

        if (result === "SCORED") {
          if (attackingSide === "home") state.homeScore += 1;
          else state.awayScore += 1;
          const stats = attackingTeam.stats.get(taker.id);
          if (stats) stats.goals += 1;
          events.push({ minute, type: "PENALTY_SCORED", side: attackingSide, playerId: taker.id });
        } else {
          events.push({ minute, type: "PENALTY_MISSED", side: attackingSide, playerId: taker.id });
          if (gk) {
            const gkStats = defendingTeam.stats.get(gk.id);
            if (gkStats) gkStats.saves += 1;
          }
        }

        state.zone = MIDFIELD;
        state.possession = defendingSide;
      } else {
        // Ordinary (non-penalty) foul: the fouled side keeps the ball for the free kick.
        state.possession = attackingSide;
      }
      break;
    }
  }
}

/** Resolves one simulated minute: perceive → decide → resolve → apply, for whichever side currently has possession. */
export function resolvePhase(state: MatchSimState, minute: number, rng: Rng): SimMatchEvent[] {
  const events: SimMatchEvent[] = [];
  const attackingSide = state.possession;
  const defendingSide = oppositeSide(attackingSide);
  const attackingTeam = state[attackingSide];
  const defendingTeam = state[defendingSide];

  const context = perceive(state, minute);
  const { action } = decideAttackAction(context, attackingTeam.squad.style, rng);
  const { reaction } = decideDefenseReaction(context, defendingTeam.squad.style, rng);

  const patternBonus = patternReadBonus(attackingTeam.pattern, action);
  const isInDefendingBox = isDefendingBoxFor(attackingSide, state.zone);

  const outcome = resolveAction(action, attackingTeam, defendingTeam, reaction, patternBonus, isInDefendingBox, rng);
  recordAction(attackingTeam.pattern, action);

  applyOutcome(state, attackingSide, outcome, minute, events, rng);

  drainStamina(attackingTeam, { hasPossession: true, isPressing: false });
  drainStamina(defendingTeam, { hasPossession: false, isPressing: reaction === "PRESS" });
  state.possessionMinutes[attackingSide] += 1;

  for (const side of ["home", "away"] as const) {
    const sub = maybeSubstituteTired(state[side], minute);
    if (sub) {
      events.push({
        minute,
        type: "SUBSTITUTION",
        side,
        playerId: sub.inPlayerId,
        metadata: { outPlayerId: sub.outPlayerId, reason: "stamina" },
      });
    }
  }

  return events;
}
