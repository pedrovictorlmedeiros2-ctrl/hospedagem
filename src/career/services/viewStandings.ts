import type { CompetitionRepository, StandingRowRecord } from "../../competitions/ports/competitionRepository.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { CareerRepository } from "../ports/careerRepository.js";
import { ensureCareerStarted } from "./ensureCareerStarted.js";
import { buildLeagueTeams, ensureRivalTeams, ensureStarterTeam, leagueNameFor } from "./ensureLeagueTeams.js";

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
  const { player, team, season } = await ensureCareerStarted(deps, input.discordId);

  const rivals = await ensureRivalTeams(deps.careerRepository, season.id);
  const leagueName = leagueNameFor(player.nationality);
  // See playCareerMatch.ts: league membership is anchored to the fixed
  // starter club, not whichever club the player currently represents.
  const starter = await ensureStarterTeam(deps.careerRepository, player.nationality, season.id);
  const { tournamentId } = await deps.competitionRepository.getOrCreateSeasonLeague({
    seasonId: season.id,
    competitionName: leagueName,
    teams: buildLeagueTeams(starter.teamId, starter.teamName, rivals),
  });

  const standings = await deps.competitionRepository.getStandings(tournamentId);
  return { leagueName, playerTeamId: team.id, standings };
}
