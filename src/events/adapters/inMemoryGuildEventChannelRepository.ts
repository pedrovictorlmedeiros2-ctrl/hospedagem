import type {
  GuildEventChannelRecord,
  GuildEventChannelRepository,
} from "../ports/guildEventChannelRepository.js";

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryGuildEventChannelRepository implements GuildEventChannelRepository {
  private readonly channelsByGuildId = new Map<string, GuildEventChannelRecord>();

  async setChannel(guildId: string, channelId: string): Promise<void> {
    this.channelsByGuildId.set(guildId, { guildId, channelId });
  }

  async getChannel(guildId: string): Promise<GuildEventChannelRecord | null> {
    return this.channelsByGuildId.get(guildId) ?? null;
  }

  async listAll(): Promise<GuildEventChannelRecord[]> {
    return [...this.channelsByGuildId.values()];
  }
}
