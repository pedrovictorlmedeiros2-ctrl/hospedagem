import type { TeamRuntimeState } from "../domain/state.js";
import { onPitchPlayers } from "./players.js";

const BASE_DRAIN_PER_MINUTE = 0.45;
const POSSESSION_EXTRA_DRAIN = 0.15;
const PRESS_EXTRA_DRAIN = 0.35;
const HALFTIME_RECOVERY = 20;

export function drainStamina(team: TeamRuntimeState, options: { hasPossession: boolean; isPressing: boolean }): void {
  const drain =
    BASE_DRAIN_PER_MINUTE +
    (options.hasPossession ? POSSESSION_EXTRA_DRAIN : 0) +
    (options.isPressing ? PRESS_EXTRA_DRAIN : 0);

  for (const player of onPitchPlayers(team)) {
    const stats = team.stats.get(player.id);
    if (!stats) continue;
    stats.stamina = Math.max(5, stats.stamina - drain);
    stats.minutesPlayed += 1;
  }
}

export function applyHalftimeRecovery(team: TeamRuntimeState): void {
  for (const stats of team.stats.values()) {
    stats.stamina = Math.min(100, stats.stamina + HALFTIME_RECOVERY);
  }
}
