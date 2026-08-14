import { randomUUID } from "node:crypto";
import { DuplicateProfileError, ProfileNotFoundError } from "../domain/errors.js";
import type {
  ClaimCooldownResult,
  NewPlayerRecord,
  PlayerAttributesPatch,
  PlayerProfilePatch,
  PlayerRecord,
  PlayerRepository,
  RankingMetric,
} from "../ports/playerRepository.js";

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
  private readonly trainingClaimsByPlayerId = new Map<string, Date>();

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

  async findById(playerId: string): Promise<PlayerRecord | null> {
    for (const record of this.byUserId.values()) {
      if (record.id === playerId) return record;
    }
    return null;
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

  async updateAttributes(userId: string, patch: PlayerAttributesPatch): Promise<PlayerRecord> {
    const existing = this.byUserId.get(userId);
    if (!existing) {
      throw new ProfileNotFoundError();
    }

    const updated: PlayerRecord = { ...existing, ...patch, updatedAt: new Date() };
    this.byUserId.set(userId, updated);
    return updated;
  }

  async listTopPlayers(metric: RankingMetric, limit: number): Promise<PlayerRecord[]> {
    const field = metric === "GLOBAL_RATING" ? "globalRating" : "overall";
    return [...this.byUserId.values()].sort((a, b) => b[field] - a[field]).slice(0, limit);
  }

  /** No `await` between the check and the write, so this is atomic per call on Node's single-threaded event loop — same reasoning as InMemoryWalletRepository.applyTransaction. */
  async tryClaimTrainingCooldown(playerId: string, now: Date, cooldownHours: number): Promise<ClaimCooldownResult> {
    const lastClaimAt = this.trainingClaimsByPlayerId.get(playerId) ?? null;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const eligible = !lastClaimAt || now.getTime() - lastClaimAt.getTime() >= cooldownMs;
    if (!eligible) {
      return { claimed: false, lastClaimAt };
    }
    this.trainingClaimsByPlayerId.set(playerId, now);
    return { claimed: true, lastClaimAt: null };
  }
}
