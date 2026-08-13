import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import type { PrismaClient } from "@prisma/client";
import type { Logger } from "../shared/logger.js";
import type { EventBus } from "../shared/eventBus.js";
import { buildCommandRegistry } from "./commandRegistry.js";
import { isAppError } from "../shared/errors.js";

export interface CreateClientDeps {
  prisma: PrismaClient;
  logger: Logger;
  events: EventBus;
}

export function createDiscordClient({ prisma, logger, events }: CreateClientDeps): Client {
  const client = new Client({
    // Slash commands + button/select interactions only — no message content
    // intent, since gameplay is entirely component-driven (see product spec:
    // "priorizar botões", never `/chutar` `/passar` style text commands).
    intents: [GatewayIntentBits.Guilds],
  });

  const commands = buildCommandRegistry();

  client.once(Events.ClientReady, (readyClient) => {
    logger.info({ tag: readyClient.user.tag, commandCount: commands.size }, "discord client ready");
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) {
      logger.warn({ commandName: interaction.commandName }, "received unknown command");
      return;
    }

    command.execute(interaction, { prisma, logger, events }).catch(async (error: unknown) => {
      const userMessage = isAppError(error)
        ? error.message
        : "Algo deu errado do nosso lado. Já registramos o erro — tenta de novo em instantes.";

      logger.error(
        { error, commandName: interaction.commandName, userId: interaction.user.id },
        "command execution failed",
      );

      const replyPayload = { content: `⚠️ ${userMessage}`, flags: MessageFlags.Ephemeral } as const;
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(replyPayload).catch(() => undefined);
      } else {
        await interaction.reply(replyPayload).catch(() => undefined);
      }
    });
  });

  return client;
}
