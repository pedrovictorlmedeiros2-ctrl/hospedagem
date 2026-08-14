export interface RivalryRecord {
  id: string;
  playerAId: string;
  playerBId: string;
  playerAWins: number;
  playerBWins: number;
  lastMatchAt: Date | null;
}

export interface RivalryRepository {
  /** Order of the two ids passed in doesn't matter — internally canonicalized (see global/domain/rivalry.ts). */
  getOrCreateRivalry(playerIdX: string, playerIdY: string): Promise<RivalryRecord>;
  /** `winnerId: null` means a draw — neither win count increments, but `lastMatchAt` still updates. */
  recordRivalryResult(playerIdX: string, playerIdY: string, winnerId: string | null, matchAt: Date): Promise<RivalryRecord>;
}
