export interface GuildEventChannelRecord {
  guildId: string;
  channelId: string;
}

/**
 * The first (and so far only) guild-scoped concept in the app — every other
 * repository is keyed by Discord user, never by server (see
 * prisma/schema.prisma's GuildEventChannel doc comment). One channel per
 * guild: setting a new one replaces the previous choice outright, there's
 * no history or multi-channel fan-out to manage.
 */
export interface GuildEventChannelRepository {
  /** Idempotent upsert — last write wins per guild. */
  setChannel(guildId: string, channelId: string): Promise<void>;
  getChannel(guildId: string): Promise<GuildEventChannelRecord | null>;
  /** Every guild currently configured to receive event notifications. */
  listAll(): Promise<GuildEventChannelRecord[]>;
}
