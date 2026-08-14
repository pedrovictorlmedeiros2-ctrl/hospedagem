import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ProfileNotFoundError } from "../../player/domain/errors.js";
import type { PlayerRecord, PlayerRepository } from "../../player/ports/playerRepository.js";
import type {
  CareerRecord,
  CareerRepository,
  ClubRecord,
  SeasonRecord,
  TeamRecord,
} from "../ports/careerRepository.js";
import { ensureStarterTeam } from "./ensureLeagueTeams.js";

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
  const existingCareer = await deps.careerRepository.getCareer(player.id);

  // Once a career exists, its `currentClubId` is the source of truth for
  // which club the player represents — NOT always the deterministic
  // starter club. This is what makes a transfer (career/services/
  // acceptTransferOffer.ts) actually stick: it updates `currentClubId`,
  // and every subsequent call here (every /carreira, /treinar,
  // /jogar-carreira) must pick that up instead of silently re-resolving
  // back to the starter club by nationality.
  let club: ClubRecord;
  let team: TeamRecord;
  if (existingCareer?.currentClubId) {
    club = await deps.careerRepository.getClubById(existingCareer.currentClubId);
    team = await deps.careerRepository.getOrCreateTeam({ clubId: club.id, seasonId: season.id, name: club.name });
  } else {
    const starter = await ensureStarterTeam(deps.careerRepository, player.nationality, season.id);
    club = starter.club;
    team = { id: starter.teamId, name: starter.teamName, clubId: starter.club.id, seasonId: season.id };
  }

  await deps.careerRepository.ensureOnRoster({
    teamId: team.id,
    playerId: player.id,
    squadNumber: player.shirtNumber,
  });

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
