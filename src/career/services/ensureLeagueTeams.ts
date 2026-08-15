import type { CompetitionRepository, LeagueTeamInput } from "../../competitions/ports/competitionRepository.js";
import type { CupRepository, CupTeamInput } from "../../competitions/ports/cupRepository.js";
import { createRng, randomInt, type Rng } from "../../game/domain/rng.js";
import { countryCodeToFlagEmoji } from "../../shared/flagEmoji.js";
import {
  CUP_WILDCARD_CLUB_KEY,
  generateClubName,
  generateDistinctClubName,
  RIVAL_CLUB_KEYS,
  starterClubKeyFor,
} from "../domain/clubNaming.js";
import type { CareerRepository, ClubRecord, SeasonRecord } from "../ports/careerRepository.js";

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

/**
 * Deliberately generic/descriptive, not a real competition's actual
 * name or brand — mirrors the "purely fictional club names" policy
 * already established in clubNaming.ts, applied to the league itself.
 * The flag carries the per-nationality identity instead of a country
 * name/demonym, matching how the rest of the UI already identifies a
 * nationality (see profileCard.ts) without a hand-maintained name map
 * for all of KNOWN_NATIONALITIES (player/domain/validators.ts).
 */
export function leagueNameFor(nationality: string): string {
  return `Campeonato Nacional ${countryCodeToFlagEmoji(nationality)} Série A`;
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
 * membership (which 7 clubs make up that nationality's Campeonato
 * Nacional — see leagueNameFor) is fixed forever once generated,
 * regardless of who has since transferred
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

/**
 * Resolves (get-or-create) the league's Tournament for a specific season —
 * rivals, starter club, calendar generation, all idempotent. Shared by
 * playCareerMatch.ts (which also drives season rollover once this
 * league's fixtures are exhausted) and viewStandings.ts, so both always
 * agree on exactly the same league instance for a given season.
 */
export async function resolveLeagueForSeason(
  careerRepository: CareerRepository,
  competitionRepository: CompetitionRepository,
  player: { nationality: string },
  season: SeasonRecord,
): Promise<{ tournamentId: string }> {
  const rivals = await ensureRivalTeams(careerRepository, season.id);
  const starter = await ensureStarterTeam(careerRepository, player.nationality, season.id);
  return competitionRepository.getOrCreateSeasonLeague({
    seasonId: season.id,
    competitionName: leagueNameFor(player.nationality),
    teams: buildLeagueTeams(starter.teamId, starter.teamName, rivals),
  });
}

/** Same naming policy as leagueNameFor — real cup-competition format/vibe, purely fictional name, per-nationality flag as the identity. */
export function cupNameFor(nationality: string): string {
  return `Copa Nacional ${countryCodeToFlagEmoji(nationality)}`;
}

const CUP_WILDCARD_TIER = 3;
const CUP_WILDCARD_REPUTATION = 40;
const CUP_WILDCARD_COUNTRY = "BR";

/**
 * The 8th club, existing only to round the league's 7 (1 starter + 6
 * rivals) up to the power of 2 a knockout bracket needs (see
 * competitions/domain/knockoutBracket.ts). Global and shared like the
 * rivals — every cup in the world includes the same wildcard — and never
 * enters the league table itself.
 */
export async function ensureCupWildcardTeam(careerRepository: CareerRepository, seasonId: string): Promise<RivalEntry> {
  const club = await careerRepository.getOrCreateClub({
    externalKey: CUP_WILDCARD_CLUB_KEY,
    name: generateDistinctClubName(createRng(CUP_WILDCARD_CLUB_KEY), RIVAL_CLUB_KEYS.length),
    country: CUP_WILDCARD_COUNTRY,
    tier: CUP_WILDCARD_TIER,
    reputation: CUP_WILDCARD_REPUTATION,
  });
  const team = await careerRepository.getOrCreateTeam({ clubId: club.id, seasonId, name: club.name });
  return { club, teamId: team.id, teamName: club.name };
}

export function buildCupTeams(starterTeamId: string, starterClubName: string, rivals: RivalEntry[], wildcard: RivalEntry): CupTeamInput[] {
  return [...buildLeagueTeams(starterTeamId, starterClubName, rivals), { teamId: wildcard.teamId, teamName: wildcard.teamName }];
}

/**
 * Resolves (get-or-create) the cup's Tournament for a specific season —
 * same league membership as resolveLeagueForSeason, plus the wildcard
 * team to reach 8 entrants. Idempotent, same pattern as
 * resolveLeagueForSeason; shared by playCupMatch.ts and viewCupStatus.ts
 * so both always agree on exactly the same cup instance for a given
 * season.
 */
export async function resolveCupForSeason(
  careerRepository: CareerRepository,
  cupRepository: CupRepository,
  player: { nationality: string },
  season: SeasonRecord,
): Promise<{ tournamentId: string }> {
  const rivals = await ensureRivalTeams(careerRepository, season.id);
  const starter = await ensureStarterTeam(careerRepository, player.nationality, season.id);
  const wildcard = await ensureCupWildcardTeam(careerRepository, season.id);
  return cupRepository.getOrCreateSeasonCup({
    seasonId: season.id,
    competitionName: cupNameFor(player.nationality),
    teams: buildCupTeams(starter.teamId, starter.teamName, rivals, wildcard),
  });
}
