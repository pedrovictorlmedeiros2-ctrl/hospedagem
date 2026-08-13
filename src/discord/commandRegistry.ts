import { Collection } from "discord.js";
import type { Command } from "./commands/types.js";
import { pingCommand } from "./commands/ping.js";

/**
 * Every slash command the bot knows about. Register a new command by adding
 * it here — commandRegistry is the single source of truth used both for
 * runtime dispatch (client.ts) and for registration with Discord
 * (deployCommands.ts), so the two can never drift apart.
 */
export function buildCommandRegistry(): Collection<string, Command> {
  const commands = new Collection<string, Command>();

  for (const command of [pingCommand]) {
    commands.set(command.data.name, command);
  }

  return commands;
}
