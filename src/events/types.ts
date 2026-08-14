/**
 * Canonical map of domain events. Adding a new event means adding one entry
 * here — every publisher and subscriber gets type-checked against it, so a
 * typo in an event name is a compile error instead of a silent no-op.
 */
export interface DomainEvents {
  PLAYER_CREATED: { playerId: string; userId: string };

  MATCH_STARTED: { matchId: string };
  MATCH_FINISHED: { matchId: string; homeScore: number; awayScore: number };

  PLAYER_STATS_UPDATED: { playerId: string; matchId: string };
  CAREER_UPDATED: { playerId: string; stage: string };
  RANKING_UPDATED: { scope: string; metric: string };
  RECORD_CHECKED: { category: string; playerId: string };
  RECORD_BROKEN: {
    category: string;
    playerId: string;
    previousHolderId: string | null;
    value: number;
  };

  TRANSFER_CREATED: { transferId: string; playerId: string; toClubId: string };
  PLAYER_CALLED_UP: { playerId: string; competitionId: string };

  CARD_OPENED: { userId: string; packId: string; cardIds: string[] };

  NEWS_CANDIDATE_CREATED: { facts: Record<string, unknown>; kind: string };
}

export type DomainEventName = keyof DomainEvents;
