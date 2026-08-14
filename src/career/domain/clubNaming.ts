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
