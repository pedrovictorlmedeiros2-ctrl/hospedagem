import type { TeamRuntimeState } from "../domain/state.js";
import { getPlayer } from "./players.js";

const MAX_SUBSTITUTIONS = 5;
const TIRED_THRESHOLD = 35;
const EARLIEST_STAMINA_SUB_MINUTE = 55;

export interface SubstitutionResult {
  outPlayerId: string;
  inPlayerId: string;
}

function substitutionsUsed(team: TeamRuntimeState): number {
  const benchStartCount = team.squad.players.length - 11;
  return benchStartCount - team.bench.length;
}

/** Picks the freshest available bench player, preferring the same position as the one going off. */
function pickReplacement(team: TeamRuntimeState, outgoingId: string): string | null {
  if (team.bench.length === 0) return null;
  const outgoing = getPlayer(team, outgoingId);
  const samePosition = team.bench.find((id) => getPlayer(team, id).position === outgoing.position);
  return samePosition ?? team.bench[0] ?? null;
}

function applySubstitution(team: TeamRuntimeState, outgoingId: string): SubstitutionResult | null {
  const replacementId = pickReplacement(team, outgoingId);
  if (!replacementId) return null;

  team.onPitch = team.onPitch.filter((id) => id !== outgoingId);
  team.bench = team.bench.filter((id) => id !== replacementId);
  team.onPitch.push(replacementId);

  return { outPlayerId: outgoingId, inPlayerId: replacementId };
}

/** Injured player forced off. Tries to bring on a replacement (consuming a substitution slot); if none is available the team simply plays short. */
export function substituteInjured(team: TeamRuntimeState, outgoingId: string): SubstitutionResult | null {
  if (substitutionsUsed(team) >= MAX_SUBSTITUTIONS) {
    team.onPitch = team.onPitch.filter((id) => id !== outgoingId);
    return null;
  }
  const result = applySubstitution(team, outgoingId);
  if (!result) {
    // No bench player available (e.g. the bench is already empty) — player still leaves the pitch.
    team.onPitch = team.onPitch.filter((id) => id !== outgoingId);
  }
  return result;
}

/** A red-carded player leaves the pitch permanently — real football never allows replacing them. */
export function sendOff(team: TeamRuntimeState, outgoingId: string): void {
  team.onPitch = team.onPitch.filter((id) => id !== outgoingId);
}

/** Stamina-driven substitution check, called once per minute per team from minute 55 onward. */
export function maybeSubstituteTired(team: TeamRuntimeState, minute: number): SubstitutionResult | null {
  if (minute < EARLIEST_STAMINA_SUB_MINUTE) return null;
  if (substitutionsUsed(team) >= MAX_SUBSTITUTIONS) return null;
  if (team.bench.length === 0) return null;

  let mostTiredId: string | null = null;
  let lowestStamina = TIRED_THRESHOLD;
  for (const id of team.onPitch) {
    const player = getPlayer(team, id);
    if (player.position === "GK") continue; // goalkeepers aren't subbed for fatigue in this v1
    const stamina = team.stats.get(id)?.stamina ?? 100;
    if (stamina < lowestStamina) {
      lowestStamina = stamina;
      mostTiredId = id;
    }
  }

  if (!mostTiredId) return null;
  return applySubstitution(team, mostTiredId);
}
