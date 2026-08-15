import { describe, expect, it } from "vitest";
import { InMemoryGuildEventChannelRepository } from "../../../../src/events/adapters/inMemoryGuildEventChannelRepository.js";
import { notifyGuildEvent, type GuildEventMessage } from "../../../../src/events/services/notifyGuildEvent.js";
import type { Logger } from "../../../../src/shared/logger.js";

function fakeLogger(): Logger {
  return { debug: () => {}, error: () => {}, warn: () => {}, info: () => {} } as unknown as Logger;
}

describe("notifyGuildEvent", () => {
  it("posts the message to every configured guild's channel", async () => {
    const guildEventChannelRepository = new InMemoryGuildEventChannelRepository();
    await guildEventChannelRepository.setChannel("guild-1", "channel-1");
    await guildEventChannelRepository.setChannel("guild-2", "channel-2");

    const posted: { channelId: string; message: GuildEventMessage }[] = [];

    await notifyGuildEvent(
      {
        guildEventChannelRepository,
        logger: fakeLogger(),
        postToChannel: async (channelId, message) => {
          posted.push({ channelId, message });
        },
      },
      { title: "Recorde quebrado!", body: "Alguém fez história." },
    );

    expect(posted).toHaveLength(2);
    expect(posted.map((entry) => entry.channelId).sort()).toEqual(["channel-1", "channel-2"]);
    expect(posted[0]?.message.title).toBe("Recorde quebrado!");
  });

  it("isolates a failure in one channel from delivery to the others", async () => {
    const guildEventChannelRepository = new InMemoryGuildEventChannelRepository();
    await guildEventChannelRepository.setChannel("guild-1", "broken-channel");
    await guildEventChannelRepository.setChannel("guild-2", "channel-2");

    const posted: string[] = [];

    await expect(
      notifyGuildEvent(
        {
          guildEventChannelRepository,
          logger: fakeLogger(),
          postToChannel: async (channelId) => {
            if (channelId === "broken-channel") throw new Error("channel deleted");
            posted.push(channelId);
          },
        },
        { title: "Recorde quebrado!", body: "Alguém fez história." },
      ),
    ).resolves.toBeUndefined();

    expect(posted).toEqual(["channel-2"]);
  });

  it("does nothing when no guild has configured an events channel", async () => {
    const guildEventChannelRepository = new InMemoryGuildEventChannelRepository();
    let calls = 0;

    await notifyGuildEvent(
      {
        guildEventChannelRepository,
        logger: fakeLogger(),
        postToChannel: async () => {
          calls += 1;
        },
      },
      { title: "x", body: "y" },
    );

    expect(calls).toBe(0);
  });
});
