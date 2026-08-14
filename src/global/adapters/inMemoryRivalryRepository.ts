import { randomUUID } from "node:crypto";
import { canonicalizeRivalryPair } from "../domain/rivalry.js";
import type { RivalryRecord, RivalryRepository } from "../ports/rivalryRepository.js";

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryRivalryRepository implements RivalryRepository {
  private readonly byKey = new Map<string, RivalryRecord>();

  private keyFor(playerAId: string, playerBId: string): string {
    return `${playerAId}:${playerBId}`;
  }

  async getOrCreateRivalry(playerIdX: string, playerIdY: string): Promise<RivalryRecord> {
    const [playerAId, playerBId] = canonicalizeRivalryPair(playerIdX, playerIdY);
    const key = this.keyFor(playerAId, playerBId);
    const existing = this.byKey.get(key);
    if (existing) return existing;

    const record: RivalryRecord = { id: randomUUID(), playerAId, playerBId, playerAWins: 0, playerBWins: 0, lastMatchAt: null };
    this.byKey.set(key, record);
    return record;
  }

  async recordRivalryResult(playerIdX: string, playerIdY: string, winnerId: string | null, matchAt: Date): Promise<RivalryRecord> {
    const rivalry = await this.getOrCreateRivalry(playerIdX, playerIdY);
    const updated: RivalryRecord = {
      ...rivalry,
      playerAWins: rivalry.playerAWins + (winnerId === rivalry.playerAId ? 1 : 0),
      playerBWins: rivalry.playerBWins + (winnerId === rivalry.playerBId ? 1 : 0),
      lastMatchAt: matchAt,
    };
    this.byKey.set(this.keyFor(rivalry.playerAId, rivalry.playerBId), updated);
    return updated;
  }
}
