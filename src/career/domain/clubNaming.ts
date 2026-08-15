import { randomInt, type Rng } from "../../game/domain/rng.js";

/**
 * Purely fictional club names — generic club-type words (used by
 * thousands of real amateur clubs, not trademark-identifying on their
 * own) combined with invented place names. Deliberately avoids anything
 * close to a specific well-known club's name.
 */
const CLUB_TYPES = [
  "Atlético",
  "Esporte Clube",
  "União Esportiva",
  "Associação Desportiva",
  "Clube Recreativo",
];
const PLACE_NAMES = [
  "Vale Verde",
  "Porto Novo",
  "Serra Alta",
  "Baía Dourada",
  "Campo Aberto",
  "Monte Claro",
  "Rio Manso",
  "Costa Azul",
  "Vila Esperança",
  "Águas Claras",
  "Pedra Branca",
  "Bosque Real",
];

export function generateClubName(rng: Rng): string {
  const type = CLUB_TYPES[randomInt(rng, 0, CLUB_TYPES.length - 1)];
  const place = PLACE_NAMES[randomInt(rng, 0, PLACE_NAMES.length - 1)];
  return `${type} ${place}`;
}

/**
 * Like `generateClubName`, but for a fixed, small, known set of clubs that
 * will all be displayed together (e.g. a league table) — two independent
 * random draws for `type`/`place` can collide by chance (found in
 * practice: two of the 6 rival clubs both generated as "Clube Recreativo
 * Porto Novo"). Indexing `place` directly by `ordinal` instead guarantees
 * every club in the set gets a distinct place name as long as
 * `ordinal < PLACE_NAMES.length` (true for any set up to 12 clubs) — only
 * `type` stays randomized for flavor.
 */
export function generateDistinctClubName(rng: Rng, ordinal: number): string {
  const type = CLUB_TYPES[randomInt(rng, 0, CLUB_TYPES.length - 1)];
  const place = PLACE_NAMES[ordinal % PLACE_NAMES.length];
  return `${type} ${place}`;
}

/** A fixed, shared pool of rival clubs — every career in the world plays against the same handful of opponents, rather than each user getting isolated single-player rivals. */
export const RIVAL_CLUB_KEYS = [
  "rival-club-1",
  "rival-club-2",
  "rival-club-3",
  "rival-club-4",
  "rival-club-5",
  "rival-club-6",
];

export function starterClubKeyFor(nationality: string): string {
  return `starter-club:${nationality}`;
}

/**
 * One extra shared club, existing only to round the league's 7 teams (1
 * starter + 6 rivals — see RIVAL_CLUB_KEYS) up to 8, the power of 2 a
 * knockout bracket needs (see competitions/domain/knockoutBracket.ts).
 * Never appears in the league table itself — see
 * career/services/ensureLeagueTeams.ts's ensureCupWildcardTeam.
 */
export const CUP_WILDCARD_CLUB_KEY = "cup-wildcard-club";
