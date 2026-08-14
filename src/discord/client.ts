import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { isAppError } from "../shared/errors.js";
import { redactError } from "../shared/redact.js";
import { buildCommandRegistry } from "./commandRegistry.js";
import type { CommandContext } from "./commands/types.js";

export type CreateClientDeps = CommandContext;

export function createDiscordClient(ctx: CreateClientDeps): Client {
  const { logger } = ctx;
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

    command.execute(interaction, ctx).catch(async (error: unknown) => {
      const userMessage = isAppError(error)
        ? error.message
        : "Algo deu errado do nosso lado. Já registramos o erro — tenta de novo em instantes.";

      // Redacted before it ever reaches the logger — a raw Prisma
      // connection error can otherwise include the full DATABASE_URL,
      // credentials and all, in its message (see RISK_REGISTER.md #9).
      logger.error(
        { error: redactError(error), commandName: interaction.commandName, userId: interaction.user.id },
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
