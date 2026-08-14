import { randomUUID } from "node:crypto";
import { DuplicateProfileError, ProfileNotFoundError } from "../domain/errors.js";
import type { NewPlayerRecord, PlayerProfilePatch, PlayerRecord, PlayerRepository } from "../ports/playerRepository.js";

/**
 * In-memory adapter — used by unit/service tests and local iteration
 * without a real Postgres instance. NOT wired into the running bot; see
 * PrismaPlayerRepository for the production implementation.
 *
 * `create` is a synchronous check-and-set inside an async function body
 * with no `await` before the write, so it never actually interleaves with
 * another call even under `Promise.all` — the same atomicity a DB unique
 * constraint gives PrismaPlayerRepository, by construction rather than by
 * locking.
 */
export class InMemoryPlayerRepository implements PlayerRepository {
  private readonly byUserId = new Map<string, PlayerRecord>();

  async create(input: NewPlayerRecord): Promise<PlayerRecord> {
    if (this.byUserId.has(input.userId)) {
      throw new DuplicateProfileError(input.userId);
    }

    const now = new Date();
    const record: PlayerRecord = {
      id: randomUUID(),
      bio: null,
      celebration: null,
      primaryColor: null,
      secondaryColor: null,
      theme: null,
      cardStyle: null,
      profileFrame: null,
      profileBackground: null,
      form: 50,
      globalRating: 0,
      stamina: 100,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.byUserId.set(input.userId, record);
    return record;
  }

  async findByUserId(userId: string): Promise<PlayerRecord | null> {
    return this.byUserId.get(userId) ?? null;
  }

  async update(userId: string, patch: PlayerProfilePatch): Promise<PlayerRecord> {
    const existing = this.byUserId.get(userId);
    if (!existing) {
      throw new ProfileNotFoundError();
    }

    const updated: PlayerRecord = { ...existing, ...patch, updatedAt: new Date() };
    this.byUserId.set(userId, updated);
    return updated;
  }
}
