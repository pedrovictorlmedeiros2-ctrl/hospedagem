import type { Client } from "discord.js";
import type { ChannelPoster } from "../events/services/notifyGuildEvent.js";

/**
 * The real ChannelPoster (see events/services/notifyGuildEvent.ts) — the
 * only place in this feature that touches discord.js directly. A channel
 * that no longer exists or is no longer text-based (e.g. the guild deleted
 * it, or it turned into a voice/forum channel) is treated as "can't
 * deliver here", not an error: notifyGuildEvent already isolates failures
 * per channel, so this simply resolves without sending.
 */
export function createGuildEventPoster(client: Client): ChannelPoster {
  return async (channelId, message) => {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) return;
    await channel.send(`### 📰 ${message.title}\n${message.body}`);
  };
}
