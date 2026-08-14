import type { PrismaClient } from "@prisma/client";
import type { ChatInputCommandInteraction } from "discord.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { EventBus } from "../../shared/eventBus.js";
import type { Logger } from "../../shared/logger.js";

export interface CommandContext {
  prisma: PrismaClient;
  logger: Logger;
  events: EventBus;
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
}

/**
 * Deliberately loose about which SlashCommandBuilder variant `data` is:
 * discord.js narrows the builder's TYPE based on which methods you call
 * (e.g. `addStringOption` returns `SlashCommandOptionsOnlyBuilder`, which
 * no longer has `addSubcommand`, enforcing Discord's "options XOR
 * subcommands" rule at compile time). A command only needs `name` (for
 * dispatch) and `toJSON` (for registration) — every builder variant has
 * both, so this interface is the least common denominator instead of
 * fighting the union.
 */
export interface Command {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void>;
}
