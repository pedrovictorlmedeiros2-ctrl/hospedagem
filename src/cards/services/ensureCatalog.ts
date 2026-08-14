import { CARDS, PACKS } from "../domain/catalog.js";
import type { CardRepository } from "../ports/cardRepository.js";

/**
 * Idempotent bootstrap for the fixed card/pack catalog — same shape as
 * career/services/ensureLeagueTeams.ts's ensureRivalTeams. Safe to call on
 * every pack-related command; a second call is a cheap no-op read for
 * every entry (get-or-create by a stable, hand-picked id).
 */
export async function ensureCatalog(cardRepository: CardRepository): Promise<void> {
  for (const card of CARDS) {
    await cardRepository.ensureCard(card);
  }
  for (const pack of PACKS) {
    await cardRepository.ensurePack(pack);
  }
}
