import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ProfileNotFoundError } from "../../player/domain/errors.js";
import type { PlayerRecord, PlayerRepository } from "../../player/ports/playerRepository.js";
import { createRng } from "../../game/domain/rng.js";
import { generateClubName, starterClubKeyFor } from "../domain/clubNaming.js";
import type {
  CareerRecord,
  CareerRepository,
  ClubRecord,
  SeasonRecord,
  TeamRecord,
} from "../ports/careerRepository.js";

const STARTER_CLUB_TIER = 4;
const STARTER_CLUB_REPUTATION = 25;

export interface EnsureCareerStartedDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
}

export interface CareerWorldContext {
  player: PlayerRecord;
  career: CareerRecord;
  club: ClubRecord;
  team: TeamRecord;
  season: SeasonRecord;
}

/**
 * Idempotent bootstrap: makes sure the calling Discord user has a career
 * (starter club, this season's team, roster membership) and returns
 * everything a career command needs. Safe to call on every /carreira,
 * /treinar and /jogar-carreira invocation — a second call for the same
 * player is a cheap no-op read, not a re-creation.
 */
export async function ensureCareerStarted(
  deps: EnsureCareerStartedDeps,
  discordId: string,
): Promise<CareerWorldContext> {
  const user = await deps.userRepository.ensureUserForDiscordId(discordId);
  const player = await deps.playerRepository.findByUserId(user.id);
  if (!player) {
    throw new ProfileNotFoundError();
  }

  const season = await deps.careerRepository.getOrCreateActiveSeason();

  const rng = createRng(starterClubKeyFor(player.nationality));
  const club = await deps.careerRepository.getOrCreateClub({
    externalKey: starterClubKeyFor(player.nationality),
    name: generateClubName(rng),
    country: player.nationality,
    tier: STARTER_CLUB_TIER,
    reputation: STARTER_CLUB_REPUTATION,
  });

  const team = await deps.careerRepository.getOrCreateTeam({
    clubId: club.id,
    seasonId: season.id,
    name: club.name,
  });
  await deps.careerRepository.ensureOnRoster({
    teamId: team.id,
    playerId: player.id,
    squadNumber: player.shirtNumber,
  });

  const existingCareer = await deps.careerRepository.getCareer(player.id);
  const career =
    existingCareer ??
    (await deps.careerRepository.createCareer({
      playerId: player.id,
      clubId: club.id,
      stage: "RESERVE",
      debutAt: new Date(),
    }));

  return { player, career, club, team, season };
}
