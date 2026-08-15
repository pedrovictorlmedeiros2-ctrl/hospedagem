import { describe, expect, it } from "vitest";
import { InMemoryGuildEventChannelRepository } from "../../../../src/events/adapters/inMemoryGuildEventChannelRepository.js";
import { setGuildEventsChannel } from "../../../../src/events/services/setGuildEventsChannel.js";

describe("setGuildEventsChannel", () => {
  it("stores the channel for the guild", async () => {
    const guildEventChannelRepository = new InMemoryGuildEventChannelRepository();

    await setGuildEventsChannel({ guildEventChannelRepository }, { guildId: "guild-1", channelId: "channel-1" });

    expect(await guildEventChannelRepository.getChannel("guild-1")).toEqual({
      guildId: "guild-1",
      channelId: "channel-1",
    });
  });

  it("replaces the previous channel when called again for the same guild", async () => {
    const guildEventChannelRepository = new InMemoryGuildEventChannelRepository();

    await setGuildEventsChannel({ guildEventChannelRepository }, { guildId: "guild-1", channelId: "channel-1" });
    await setGuildEventsChannel({ guildEventChannelRepository }, { guildId: "guild-1", channelId: "channel-2" });

    expect(await guildEventChannelRepository.getChannel("guild-1")).toEqual({
      guildId: "guild-1",
      channelId: "channel-2",
    });
  });
});
