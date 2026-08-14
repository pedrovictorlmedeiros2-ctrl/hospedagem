import { randomUUID } from "node:crypto";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ProfileNotFoundError } from "../../player/domain/errors.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { EventBus } from "../../shared/eventBus.js";
import { buildSquadFromProfile } from "../domain/buildSquadFromProfile.js";
import { generateSquad } from "../domain/generateSquad.js";
import { createRng, weightedPick, type Rng } from "../domain/rng.js";
import type { MatchResult, MatchSquad, TeamStyle } from "../domain/types.js";
import { simulateMatch } from "../engine/simulateMatch.js";

const ALL_STYLES: TeamStyle[] = [
  "DEFENSIVE",
  "AGGRESSIVE",
  "POSSESSION",
  "COUNTER_ATTACK",
  "DRIBBLING",
  "TACTICAL",
];

function randomStyle(rng: Rng): TeamStyle {
  return weightedPick(
    rng,
    ALL_STYLES.map((style) => [style, 1] as const),
  );
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

  const home = buildSquadFromProfile(player, {
    teamId: `player-${player.userId}`,
    teamName: `${player.name} FC`,
    rng: squadRng,
    placement: "STARTING",
  });
  const away = generateSquad({
    teamId: `npc-${user.id}`,
    teamName: "Seleção Amistosa",
    style: input.opponentStyle ?? randomStyle(squadRng),
    avgOverall: input.opponentAvgOverall ?? player.overall,
    rng: squadRng,
  });

  deps.events.emit("MATCH_STARTED", { matchId: seed });
  const result = simulateMatch(home, away, { seed });
  deps.events.emit("MATCH_FINISHED", {
    matchId: seed,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
  });

  return { result, home, away };
}
