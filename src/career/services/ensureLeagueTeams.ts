import type { LeagueTeamInput } from "../../competitions/ports/competitionRepository.js";
import { createRng, randomInt, type Rng } from "../../game/domain/rng.js";
import { generateClubName, generateDistinctClubName, RIVAL_CLUB_KEYS, starterClubKeyFor } from "../domain/clubNaming.js";
import type { CareerRepository, ClubRecord } from "../ports/careerRepository.js";

/** Fictional country codes for rival clubs — just flavor, not tied to any real confederation. */
const OPPONENT_COUNTRIES = ["AR", "PT", "ES", "FR", "DE", "IT", "UY", "NL"];
const OPPONENT_TIER = 3;
const OPPONENT_REPUTATION = 45;

const STARTER_CLUB_TIER = 4;
const STARTER_CLUB_REPUTATION = 25;

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

/**
 * The per-nationality starter club — shared by every player of that
 * nationality, exactly like the 6 rivals are shared globally. Idempotent,
 * same pattern as ensureRivalTeams.
 *
 * Deliberately independent of any specific player's CURRENT club: league
 * membership (which 7 clubs make up "Liga de Acesso — <nationality>") is
 * fixed forever once generated, regardless of who has since transferred
 * away from the starter club or into one of the rivals. Callers that need
 * "the club a specific player currently represents" should use
 * `career.currentClubId` (see ensureCareerStarted.ts), not this.
 */
export async function ensureStarterTeam(
  careerRepository: CareerRepository,
  nationality: string,
  seasonId: string,
): Promise<RivalEntry> {
  const key = starterClubKeyFor(nationality);
  const club = await careerRepository.getOrCreateClub({
    externalKey: key,
    name: generateClubName(createRng(key)),
    country: nationality,
    tier: STARTER_CLUB_TIER,
    reputation: STARTER_CLUB_REPUTATION,
  });
  const team = await careerRepository.getOrCreateTeam({ clubId: club.id, seasonId, name: club.name });
  return { club, teamId: team.id, teamName: club.name };
}

export function buildLeagueTeams(starterTeamId: string, starterClubName: string, rivals: RivalEntry[]): LeagueTeamInput[] {
  return [{ teamId: starterTeamId, teamName: starterClubName }, ...rivals.map((rival) => ({ teamId: rival.teamId, teamName: rival.teamName }))];
}
