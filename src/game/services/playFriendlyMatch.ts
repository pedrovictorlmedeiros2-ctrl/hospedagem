import { randomUUID } from "node:crypto";
import type { Position } from "@prisma/client";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ProfileNotFoundError } from "../../player/domain/errors.js";
import type { PlayerRecord, PlayerRepository } from "../../player/ports/playerRepository.js";
import type { EventBus } from "../../shared/eventBus.js";
import { generateSquad } from "../domain/generateSquad.js";
import { createRng, weightedPick, type Rng } from "../domain/rng.js";
import type { MatchPlayerInput, MatchSquad, TeamStyle } from "../domain/types.js";
import { simulateMatch } from "../engine/simulateMatch.js";
import type { MatchResult } from "../domain/types.js";

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
 * The synthetic starting XI is a fixed 4-4-2 (see generateSquad.ts), which
 * doesn't literally cover every Position value (no DM/AM/LW/RW slot). A
 * real player whose position isn't in the formation must still replace
 * someone from the *same position group* — falling back to "replace index
 * 0" would silently overwrite the goalkeeper with an outfield player and
 * break validateSquad's "exactly one GK" rule for every DM/AM/LW/RW
 * profile. Never returns the goalkeeper's index unless `position` is
 * itself GK.
 */
function findReplacementIndex(starters: MatchPlayerInput[], position: Position): number {
  const exact = starters.findIndex((candidate) => candidate.position === position);
  if (exact !== -1) return exact;

  const group = POSITION_GROUP[position];
  const sameGroup = starters.findIndex((candidate) => candidate.position !== "GK" && POSITION_GROUP[candidate.position] === group);
  if (sameGroup !== -1) return sameGroup;

  const anyOutfield = starters.findIndex((candidate) => candidate.position !== "GK");
  return anyOutfield !== -1 ? anyOutfield : 0;
}

const ALL_STYLES: TeamStyle[] = ["DEFENSIVE", "AGGRESSIVE", "POSSESSION", "COUNTER_ATTACK", "DRIBBLING", "TACTICAL"];

function randomStyle(rng: Rng): TeamStyle {
  return weightedPick(rng, ALL_STYLES.map((style) => [style, 1] as const));
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

/**
 * Builds a synthetic 4-4-2 squad around the caller's real created player
 * (Fase 2) so the friendly means something personally, while being honest
 * that everyone else on the pitch is generated filler — there is no real
 * club roster system yet (that's Fase 4/6).
 */
function buildSquadFromProfile(player: PlayerRecord, rng: Rng): MatchSquad {
  const teamId = `player-${player.userId}`;
  const squad = generateSquad({ teamId, teamName: `${player.name} FC`, style: "TACTICAL", avgOverall: player.overall, rng });

  const realPlayer = toMatchPlayerInput(player, `real-${player.id}`);
  const starters = squad.players.slice(0, 11);
  const replaceIndex = findReplacementIndex(starters, player.position);

  const players = [...squad.players];
  players[replaceIndex] = realPlayer;

  return { ...squad, players };
}

export interface PlayFriendlyMatchInput {
  discordId: string;
  opponentAvgOverall?: number;
  opponentStyle?: TeamStyle;
}

export interface PlayFriendlyMatchDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  events: EventBus;
}

export interface PlayFriendlyMatchOutput {
  result: MatchResult;
  home: MatchSquad;
  away: MatchSquad;
}

export async function playFriendlyMatch(
  deps: PlayFriendlyMatchDeps,
  input: PlayFriendlyMatchInput,
): Promise<PlayFriendlyMatchOutput> {
  const user = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const player = await deps.playerRepository.findByUserId(user.id);
  if (!player) {
    throw new ProfileNotFoundError();
  }

  const seed = randomUUID();
  const squadRng = createRng(`${seed}:squads`);

  const home = buildSquadFromProfile(player, squadRng);
  const away = generateSquad({
    teamId: `npc-${user.id}`,
    teamName: "Seleção Amistosa",
    style: input.opponentStyle ?? randomStyle(squadRng),
    avgOverall: input.opponentAvgOverall ?? player.overall,
    rng: squadRng,
  });

  deps.events.emit("MATCH_STARTED", { matchId: seed });
  const result = simulateMatch(home, away, { seed });
  deps.events.emit("MATCH_FINISHED", { matchId: seed, homeScore: result.homeScore, awayScore: result.awayScore });

  return { result, home, away };
}
