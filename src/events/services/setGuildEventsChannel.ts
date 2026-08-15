import type { GuildEventChannelRepository } from "../ports/guildEventChannelRepository.js";

export interface SetGuildEventsChannelDeps {
  guildEventChannelRepository: GuildEventChannelRepository;
}

export interface SetGuildEventsChannelInput {
  guildId: string;
  channelId: string;
}

/** Thin as it is today because there's no validation beyond "these two IDs exist" — kept as a service (not a direct repository call from the command) so it typechecks and tests the same way every other mutation in this codebase does. */
export async function setGuildEventsChannel(
  deps: SetGuildEventsChannelDeps,
  input: SetGuildEventsChannelInput,
): Promise<void> {
  await deps.guildEventChannelRepository.setChannel(input.guildId, input.channelId);
}
