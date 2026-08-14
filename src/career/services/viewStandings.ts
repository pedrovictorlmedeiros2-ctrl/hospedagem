import type { CompetitionRepository, StandingRowRecord } from "../../competitions/ports/competitionRepository.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { CareerRepository } from "../ports/careerRepository.js";
import { ensureCareerStarted } from "./ensureCareerStarted.js";
import { leagueNameFor, resolveLeagueForSeason } from "./ensureLeagueTeams.js";

export interface ViewStandingsDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
  competitionRepository: CompetitionRepository;
}

export interface ViewStandingsOutput {
  leagueName: string;
  playerTeamId: string;
  standings: StandingRowRecord[];
  seasonNumber: number;
}

export async function viewStandings(deps: ViewStandingsDeps, input: { discordId: string }): Promise<ViewStandingsOutput> {
  const { player, team, season } = await ensureCareerStarted(deps, input.discordId);

  const leagueName = leagueNameFor(player.nationality);
  // See playCareerMatch.ts: league membership is anchored to the fixed
  // starter club, not whichever club the player currently represents.
  const { tournamentId } = await resolveLeagueForSeason(deps.careerRepository, deps.competitionRepository, player, season);

  const standings = await deps.competitionRepository.getStandings(tournamentId);
  return { leagueName, playerTeamId: team.id, standings, seasonNumber: season.number };
}
