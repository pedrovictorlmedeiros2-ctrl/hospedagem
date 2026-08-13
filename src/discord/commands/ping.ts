import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import type { Command } from "./types.js";

/**
 * Health-check command. Doubles as the reference implementation for how
 * every future screen should be built with Components V2: a ContainerBuilder
 * holding TextDisplay/Separator blocks, sent with the IsComponentsV2 flag
 * and no legacy `content`/`embeds`.
 */
export const pingCommand: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Verifica se o Football Game está no ar."),

  async execute(interaction, ctx) {
    const start = Date.now();

    const dbOk = await ctx.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch((error: unknown) => {
        ctx.logger.error({ error }, "health check: database unreachable");
        return false;
      });

    const latencyMs = Date.now() - start;

    const container = new ContainerBuilder()
      .setAccentColor(dbOk ? 0x2ecc71 : 0xe74c3c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### ⚽ Football Game"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**Bot:** 🟢 online (${latencyMs}ms)`,
            `**Banco de dados:** ${dbOk ? "🟢 conectado" : "🔴 indisponível"}`,
          ].join("\n"),
        ),
      );

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
