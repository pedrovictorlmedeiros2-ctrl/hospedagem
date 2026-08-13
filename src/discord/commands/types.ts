import type { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { Logger } from "../../shared/logger.js";
import type { EventBus } from "../../shared/eventBus.js";
import type { PrismaClient } from "@prisma/client";

export interface CommandContext {
  prisma: PrismaClient;
  logger: Logger;
  events: EventBus;
}

export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void>;
}
