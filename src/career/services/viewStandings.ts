import type { CompetitionRepository, StandingRowRecord } from "../../competitions/ports/competitionRepository.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { CareerRepository } from "../ports/careerRepository.js";
import { ensureCareerStarted } from "./ensureCareerStarted.js";
import { buildLeagueTeams, ensureRivalTeams, leagueNameFor } from "./ensureLeagueTeams.js";

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
}

export async function viewStandings(deps: ViewStandingsDeps, input: { discordId: string }): Promise<ViewStandingsOutput> {
  const { player, club, team, season } = await ensureCareerStarted(deps, input.discordId);

  const rivals = await ensureRivalTeams(deps.careerRepository, season.id);
  const leagueName = leagueNameFor(player.nationality);
  const { tournamentId } = await deps.competitionRepository.getOrCreateSeasonLeague({
    seasonId: season.id,
    competitionName: leagueName,
    teams: buildLeagueTeams(team.id, club.name, rivals),
  });

  const standings = await deps.competitionRepository.getStandings(tournamentId);
  return { leagueName, playerTeamId: team.id, standings };
}
