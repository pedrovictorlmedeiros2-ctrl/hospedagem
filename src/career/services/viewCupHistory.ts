import type { CupRepository } from "../../competitions/ports/cupRepository.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { CareerRepository } from "../ports/careerRepository.js";
import { ensureCareerStarted } from "./ensureCareerStarted.js";
import { cupNameFor } from "./ensureLeagueTeams.js";

export interface ViewCupHistoryDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
  cupRepository: CupRepository;
}

export interface CupHistoryEntry {
  seasonNumber: number;
  championTeamName: string;
}

export interface ViewCupHistoryOutput {
  cupName: string;
  /** Oldest first. Only seasons where the cup actually crowned a champion — a season nobody ever ran /copa in just isn't listed, not shown as "sem campeão". */
  entries: CupHistoryEntry[];
}

/**
 * Every past season up to (and including) the career's current one, in
 * order — cheap because `getOrCreateSeason` is idempotent for any number
 * that already exists (every season below the current one necessarily
 * does, by construction: rollover only ever moves forward — see
 * playCareerMatch.ts), and `getChampionForSeason` never creates anything.
 */
export async function viewCupHistory(deps: ViewCupHistoryDeps, input: { discordId: string; now?: Date }): Promise<ViewCupHistoryOutput> {
  const now = input.now ?? new Date();
  const { player, season } = await ensureCareerStarted(deps, input.discordId, now);
  const cupName = cupNameFor(player.nationality);

  const entries: CupHistoryEntry[] = [];
  for (let seasonNumber = 1; seasonNumber <= season.number; seasonNumber++) {
    const pastSeason = await deps.careerRepository.getOrCreateSeason(seasonNumber, now);
    const championTeamName = await deps.cupRepository.getChampionForSeason(cupName, pastSeason.id);
    if (championTeamName) entries.push({ seasonNumber, championTeamName });
  }

  return { cupName, entries };
}
