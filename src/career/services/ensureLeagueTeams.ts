import type { LeagueTeamInput } from "../../competitions/ports/competitionRepository.js";
import { createRng, randomInt, type Rng } from "../../game/domain/rng.js";
import { generateDistinctClubName, RIVAL_CLUB_KEYS } from "../domain/clubNaming.js";
import type { CareerRepository, ClubRecord } from "../ports/careerRepository.js";

/** Fictional country codes for rival clubs — just flavor, not tied to any real confederation. */
const OPPONENT_COUNTRIES = ["AR", "PT", "ES", "FR", "DE", "IT", "UY", "NL"];
const OPPONENT_TIER = 3;
const OPPONENT_REPUTATION = 45;

function pickFrom<T>(rng: Rng, options: readonly T[]): T {
  const index = randomInt(rng, 0, options.length - 1);
  const value = options[index];
  if (value === undefined) {
    throw new Error("Internal error: pickFrom called with an empty options list");
  }
  return value;
}

export function leagueNameFor(nationality: string): string {
  return `Liga de Acesso — ${nationality}`;
}

export interface RivalEntry {
  club: ClubRecord;
  teamId: string;
  teamName: string;
}

/** Idempotent: every rival club/team already exists after the first call for any nationality — this just resolves them (get-or-create is cheap). Shared by playCareerMatch and viewStandings so both agree on exactly the same league membership. */
export async function ensureRivalTeams(careerRepository: CareerRepository, seasonId: string): Promise<RivalEntry[]> {
  const entries: RivalEntry[] = [];
  for (const [ordinal, key] of RIVAL_CLUB_KEYS.entries()) {
    const club = await careerRepository.getOrCreateClub({
      externalKey: key,
      // Ordinal-indexed, not independently hashed — see
      // generateDistinctClubName's doc comment: two rival clubs
      // generating the identical name (found in practice) would be
      // confusing sitting side by side in a league table.
      name: generateDistinctClubName(createRng(key), ordinal),
      country: pickFrom(createRng(`${key}:country`), OPPONENT_COUNTRIES),
      tier: OPPONENT_TIER,
      reputation: OPPONENT_REPUTATION,
    });
    const team = await careerRepository.getOrCreateTeam({ clubId: club.id, seasonId, name: club.name });
    entries.push({ club, teamId: team.id, teamName: club.name });
  }
  return entries;
}

export function buildLeagueTeams(playerTeamId: string, playerClubName: string, rivals: RivalEntry[]): LeagueTeamInput[] {
  return [{ teamId: playerTeamId, teamName: playerClubName }, ...rivals.map((rival) => ({ teamId: rival.teamId, teamName: rival.teamName }))];
}
