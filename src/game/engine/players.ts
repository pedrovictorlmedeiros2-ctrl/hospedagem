import type { Position } from "@prisma/client";
import { weightedPick, type Rng } from "../domain/rng.js";
import type { TeamRuntimeState } from "../domain/state.js";
import type { MatchPlayerInput } from "../domain/types.js";

export function getPlayer(team: TeamRuntimeState, id: string): MatchPlayerInput {
  const player = team.squad.players.find((candidate) => candidate.id === id);
  if (!player) {
    // Invariant violation, not a user-facing error — onPitch/bench ids
    // always come from this same squad's player list.
    throw new Error(`Internal error: player ${id} not found in squad ${team.squad.teamId}`);
  }
  return player;
}

export function onPitchPlayers(team: TeamRuntimeState): MatchPlayerInput[] {
  return team.onPitch.map((id) => getPlayer(team, id));
}

const ATTACKER_POSITIONS: Position[] = ["ST", "LW", "RW", "AM"];
const CREATIVE_POSITIONS: Position[] = ["CM", "AM", "LM", "RM", "DM"];
const DRIBBLE_POSITIONS: Position[] = ["LW", "RW", "AM", "ST", "LM", "RM"];
const DEFENDER_POSITIONS: Position[] = ["CB", "LB", "RB", "DM"];

function pickWeighted(
  candidates: MatchPlayerInput[],
  rng: Rng,
  rate: (player: MatchPlayerInput) => number,
): MatchPlayerInput {
  const entries = candidates.map((player) => [player, Math.max(1, rate(player))] as const);
  return weightedPick(rng, entries);
}

function pickFromPreferred(
  team: TeamRuntimeState,
  preferred: Position[],
  rng: Rng,
  rate: (p: MatchPlayerInput) => number,
): MatchPlayerInput {
  const candidates = onPitchPlayers(team).filter((player) => player.position !== "GK");
  const inPosition = candidates.filter((player) => preferred.includes(player.position));
  const pool = inPosition.length > 0 ? inPosition : candidates;
  return pickWeighted(pool, rng, rate);
}

export function pickAttacker(team: TeamRuntimeState, rng: Rng): MatchPlayerInput {
  return pickFromPreferred(team, ATTACKER_POSITIONS, rng, (p) => p.shooting);
}

export function pickPasser(team: TeamRuntimeState, rng: Rng): MatchPlayerInput {
  return pickFromPreferred(team, CREATIVE_POSITIONS, rng, (p) => p.passing);
}

export function pickDribbler(team: TeamRuntimeState, rng: Rng): MatchPlayerInput {
  return pickFromPreferred(team, DRIBBLE_POSITIONS, rng, (p) => p.dribbling);
}

export function pickDefender(team: TeamRuntimeState, rng: Rng): MatchPlayerInput {
  return pickFromPreferred(team, DEFENDER_POSITIONS, rng, (p) => p.defending);
}

export function getGoalkeeper(team: TeamRuntimeState): MatchPlayerInput | null {
  const gkId = team.onPitch.find((id) => getPlayer(team, id).position === "GK");
  return gkId ? getPlayer(team, gkId) : null;
}

export function gkRating(gk: MatchPlayerInput | null): number {
  if (!gk) return 25; // no keeper on the pitch (sent off with no sub available) — heavily exposed
  const values = [gk.gkReflexes, gk.gkPositioning, gk.gkOneOnOne, gk.gkAerial].filter(
    (value): value is number => value !== null,
  );
  if (values.length === 0) return 25;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
