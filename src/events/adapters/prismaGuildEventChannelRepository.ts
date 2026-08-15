import type { PrismaClient } from "@prisma/client";
import type {
  GuildEventChannelRecord,
  GuildEventChannelRepository,
} from "../ports/guildEventChannelRepository.js";

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — no
 * DATABASE_URL was available to run it end-to-end. See docs/ROADMAP.md.
 */
export class PrismaGuildEventChannelRepository implements GuildEventChannelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async setChannel(guildId: string, channelId: string): Promise<void> {
    await this.prisma.guildEventChannel.upsert({
      where: { guildId },
      create: { guildId, channelId },
      update: { channelId },
    });
  }

  async getChannel(guildId: string): Promise<GuildEventChannelRecord | null> {
    const row = await this.prisma.guildEventChannel.findUnique({ where: { guildId } });
    return row ? { guildId: row.guildId, channelId: row.channelId } : null;
  }

  async listAll(): Promise<GuildEventChannelRecord[]> {
    const rows = await this.prisma.guildEventChannel.findMany();
    return rows.map((row) => ({ guildId: row.guildId, channelId: row.channelId }));
  }
}
