import { randomUUID } from "node:crypto";
import type { UserRecord, UserRepository } from "../ports/userRepository.js";

/**
 * In-memory adapter for tests and local iteration without a real database.
 * NOT wired into the running bot — see PrismaUserRepository.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly byDiscordId = new Map<string, UserRecord>();

  async ensureUserForDiscordId(discordId: string): Promise<UserRecord> {
    const existing = this.byDiscordId.get(discordId);
    if (existing) return existing;

    const record: UserRecord = { id: randomUUID(), discordId };
    this.byDiscordId.set(discordId, record);
    return record;
  }
}
