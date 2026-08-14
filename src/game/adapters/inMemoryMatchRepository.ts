import { randomUUID } from "node:crypto";
import type {
  MatchRepository,
  PersistedMatch,
  PersistedSeasonStat,
  PersistMatchResultInput,
} from "../ports/matchRepository.js";

export interface RecordedMatch {
  matchId: string;
  input: PersistMatchResultInput;
}

/**
 * In-memory adapter for tests. Keeps every persisted call around
 * (`recorded`) so a test can assert on exactly what would have been
 * written, and maintains the same per-player-per-season aggregate the
 * Prisma adapter computes, so service-level tests see realistic
 * `seasonStat` values across multiple matches.
 */
export class InMemoryMatchRepository implements MatchRepository {
  readonly recorded: RecordedMatch[] = [];
  private readonly seasonStats = new Map<string, PersistedSeasonStat>();

  async persistMatchResult(input: PersistMatchResultInput): Promise<PersistedMatch> {
    const { result, realPlayer } = input;
    const realStat = result.playerStats.find(
      (stat) => stat.playerId === realPlayer.matchPlayerInputId,
    );
    if (!realStat) {
      throw new Error(
        `Internal error: no stat line found for the real player (matchPlayerInputId=${realPlayer.matchPlayerInputId})`,
      );
    }

    const matchId = randomUUID();
    this.recorded.push({ matchId, input });

    const key = `${realPlayer.playerId}:${input.seasonId}`;
    const existing = this.seasonStats.get(key);
    const seasonStat: PersistedSeasonStat = existing
      ? {
          matches: existing.matches + 1,
          goals: existing.goals + realStat.goals,
          assists: existing.assists + realStat.assists,
          avgRating:
            (existing.avgRating * existing.matches + realStat.rating) / (existing.matches + 1),
        }
      : {
          matches: 1,
          goals: realStat.goals,
          assists: realStat.assists,
          avgRating: realStat.rating,
        };
    this.seasonStats.set(key, seasonStat);

    return { matchId, seasonStat };
  }

  async getPlayerSeasonStat(
    playerId: string,
    seasonId: string,
  ): Promise<PersistedSeasonStat | null> {
    return this.seasonStats.get(`${playerId}:${seasonId}`) ?? null;
  }
}
