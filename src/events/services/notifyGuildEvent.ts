import type { Logger } from "../../shared/logger.js";
import type { GuildEventChannelRepository } from "../ports/guildEventChannelRepository.js";

export interface GuildEventMessage {
  title: string;
  body: string;
}

/**
 * Delivers a message to a single channel. Injected rather than imported
 * directly, so this service — like every other service in the codebase —
 * stays free of discord.js: the real implementation (client.channels.fetch
 * + send) lives in src/discord/guildEventPoster.ts, wired up in
 * src/index.ts once the Discord client exists.
 */
export type ChannelPoster = (channelId: string, message: GuildEventMessage) => Promise<void>;

export interface NotifyGuildEventDeps {
  guildEventChannelRepository: GuildEventChannelRepository;
  postToChannel: ChannelPoster;
  logger: Logger;
}

/**
 * Fans a domain event out to every guild that configured an events channel
 * (see /canal-eventos). One guild's channel being deleted, or the bot
 * lacking permission to post there, must never stop delivery to the
 * others — each failure is caught and logged individually.
 */
export async function notifyGuildEvent(deps: NotifyGuildEventDeps, message: GuildEventMessage): Promise<void> {
  const channels = await deps.guildEventChannelRepository.listAll();

  await Promise.all(
    channels.map(async (channel) => {
      try {
        await deps.postToChannel(channel.channelId, message);
      } catch (error) {
        deps.logger.warn(
          { error, guildId: channel.guildId, channelId: channel.channelId },
          "failed to post guild event notification",
        );
      }
    }),
  );
}
