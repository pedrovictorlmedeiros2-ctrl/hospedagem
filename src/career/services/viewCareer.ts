import type { CareerRecord, CareerRepository, ClubRecord } from "../ports/careerRepository.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRecord, PlayerRepository } from "../../player/ports/playerRepository.js";
import type { MatchRepository, PersistedSeasonStat } from "../../game/ports/matchRepository.js";
import { ensureCareerStarted } from "./ensureCareerStarted.js";

export interface ViewCareerDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
  matchRepository: MatchRepository;
}

export interface ViewCareerOutput {
  player: PlayerRecord;
  career: CareerRecord;
  club: ClubRecord;
  seasonStat: PersistedSeasonStat | null;
  hasActiveInjury: boolean;
}

export async function viewCareer(
  deps: ViewCareerDeps,
  input: { discordId: string; now?: Date },
): Promise<ViewCareerOutput> {
  const now = input.now ?? new Date();
  const { player, career, club, season } = await ensureCareerStarted(deps, input.discordId);

  const [seasonStat, hasActiveInjury] = await Promise.all([
    deps.matchRepository.getPlayerSeasonStat(player.id, season.id),
    deps.careerRepository.hasActiveInjury(player.id, now),
  ]);

  return { player, career, club, seasonStat, hasActiveInjury };
}
