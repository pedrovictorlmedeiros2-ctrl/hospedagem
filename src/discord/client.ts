import { Client, Events, GatewayIntentBits, MessageFlags, type RepliableInteraction } from "discord.js";
import { isAppError } from "../shared/errors.js";
import { redactError } from "../shared/redact.js";
import { buildCommandRegistry } from "./commandRegistry.js";
import type { CommandContext } from "./commands/types.js";
import { buildMenuActionRegistry, MENU_BUTTON_PREFIX } from "./menuActions.js";

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
  const menuActions = buildMenuActionRegistry();

  client.once(Events.ClientReady, (readyClient) => {
    logger.info(
      { tag: readyClient.user.tag, commandCount: commands.size, menuActionCount: menuActions.size },
      "discord client ready",
    );
  });

  /**
   * Shared by both interaction kinds below — reports a handler failure the
   * same way (redacted, logged, ephemeral reply-or-followup) regardless of
   * whether it came from a typed slash command or a button click.
   */
  async function reportHandlerFailure(
    interaction: RepliableInteraction,
    error: unknown,
    context: Record<string, unknown>,
  ): Promise<void> {
    const userMessage = isAppError(error)
      ? error.message
      : "Algo deu errado do nosso lado. Já registramos o erro — tenta de novo em instantes.";

    // Redacted before it ever reaches the logger — a raw Prisma
    // connection error can otherwise include the full DATABASE_URL,
    // credentials and all, in its message (see RISK_REGISTER.md #9).
    logger.error({ error: redactError(error), ...context }, "interaction handler failed");

    const replyPayload = { content: `⚠️ ${userMessage}`, flags: MessageFlags.Ephemeral } as const;
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(replyPayload).catch(() => undefined);
    } else {
      await interaction.reply(replyPayload).catch(() => undefined);
    }
  }

  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        logger.warn({ commandName: interaction.commandName }, "received unknown command");
        return;
      }

      command.execute(interaction, ctx).catch((error: unknown) =>
        reportHandlerFailure(interaction, error, {
          commandName: interaction.commandName,
          userId: interaction.user.id,
        }),
      );
      return;
    }

    // Every OTHER button click (e.g. the match-tactic buttons in
    // jogarCarreira.ts) is handled by its own message-scoped
    // `awaitMessageComponent` collector, set up independently of this
    // listener — discord.js delivers interactionCreate to both, so this
    // branch must ignore anything it doesn't own. Replying/deferring here
    // for a customId some OTHER collector is also about to acknowledge
    // would throw "interaction has already been acknowledged".
    if (interaction.isButton() && interaction.customId.startsWith(MENU_BUTTON_PREFIX)) {
      const key = interaction.customId.slice(MENU_BUTTON_PREFIX.length);
      const action = menuActions.get(key);
      if (!action) {
        logger.warn({ menuActionKey: key }, "received unknown menu action");
        return;
      }

      action.handler(interaction, ctx).catch((error: unknown) =>
        reportHandlerFailure(interaction, error, {
          menuActionKey: key,
          userId: interaction.user.id,
        }),
      );
    }
  });

  return client;
}
