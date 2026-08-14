import type { Position } from "@prisma/client";
import type { PlayerRecord } from "../../player/ports/playerRepository.js";
import { generateSquad } from "./generateSquad.js";
import type { Rng } from "./rng.js";
import type { MatchPlayerInput, MatchSquad } from "./types.js";

type PositionGroup = "GK" | "DEF" | "MID" | "ATT";

const POSITION_GROUP: Record<Position, PositionGroup> = {
  GK: "GK",
  CB: "DEF",
  LB: "DEF",
  RB: "DEF",
  DM: "DEF",
  CM: "MID",
  AM: "MID",
  LM: "MID",
  RM: "MID",
  LW: "ATT",
  RW: "ATT",
  ST: "ATT",
};

/**
 * The synthetic squad is a fixed 4-4-2 with a 6-player bench (see
 * generateSquad.ts), which doesn't literally cover every Position value
 * (no DM/AM/LW/RW slot). A real player whose position isn't in the
 * formation must still replace someone from the *same position group* —
 * falling back to "replace index 0" would silently overwrite the
 * goalkeeper with an outfield player and break validateSquad's "exactly
 * one GK" rule for every DM/AM/LW/RW profile. Never returns the
 * goalkeeper's index unless `position` is itself GK.
 */
function findReplacementIndex(pool: MatchPlayerInput[], position: Position): number {
  const exact = pool.findIndex((candidate) => candidate.position === position);
  if (exact !== -1) return exact;

  const group = POSITION_GROUP[position];
  const sameGroup = pool.findIndex(
    (candidate) => candidate.position !== "GK" && POSITION_GROUP[candidate.position] === group,
  );
  if (sameGroup !== -1) return sameGroup;

  const anyOutfield = pool.findIndex((candidate) => candidate.position !== "GK");
  return anyOutfield !== -1 ? anyOutfield : 0;
}

function toMatchPlayerInput(player: PlayerRecord, id: string): MatchPlayerInput {
  return {
    id,
    name: player.name,
    position: player.position,
    overall: player.overall,
    pace: player.pace,
    shooting: player.shooting,
    passing: player.passing,
    dribbling: player.dribbling,
    defending: player.defending,
    physical: player.physical,
    gkReflexes: player.gkReflexes,
    gkPositioning: player.gkPositioning,
    gkHandling: player.gkHandling,
    gkAerial: player.gkAerial,
    gkOneOnOne: player.gkOneOnOne,
    gkPenalties: player.gkPenalties,
  };
}

/** The id the real player is given inside the engine — used by callers to find their stat line / filter events after the fact. */
export function realPlayerMatchId(player: PlayerRecord): string {
  return `real-${player.id}`;
}

export interface BuildSquadOptions {
  teamId: string;
  teamName: string;
  rng: Rng;
  /** STARTING replaces a same-position-group starter (the escalação decided this player is fit and selected); BENCH replaces a same-position-group substitute instead — they may still get minutes if the in-match engine subs them on. */
  placement: "STARTING" | "BENCH";
}

/**
 * Builds a synthetic 4-4-2 (+ bench) squad around a real created player
 * (Fase 2), so a simulated match means something personally, while being
 * honest that everyone else on the pitch is generated filler — there is
 * no real multi-player club roster system (that's Fase 6/marketplace
 * territory: today, one Discord user has exactly one real Player).
 */
export function buildSquadFromProfile(
  player: PlayerRecord,
  options: BuildSquadOptions,
): MatchSquad {
  const squad = generateSquad({
    teamId: options.teamId,
    teamName: options.teamName,
    style: "TACTICAL",
    avgOverall: player.overall,
    rng: options.rng,
  });

  const realPlayer = toMatchPlayerInput(player, realPlayerMatchId(player));
  const starters = squad.players.slice(0, 11);
  const bench = squad.players.slice(11);
  const pool = options.placement === "STARTING" ? starters : bench;
  const poolOffset = options.placement === "STARTING" ? 0 : 11;

  const replaceIndex = poolOffset + findReplacementIndex(pool, player.position);

  const players = [...squad.players];
  players[replaceIndex] = realPlayer;

  return { ...squad, players };
}
