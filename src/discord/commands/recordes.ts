import { ContainerBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder } from "discord.js";
import { RECORD_CATEGORY_LABELS } from "../../global/domain/records.js";
import { viewRecords } from "../../global/services/viewRecords.js";
import type { Command } from "./types.js";

export const recordesCommand: Command = {
  data: new SlashCommandBuilder().setName("recordes").setDescription("Mostra o Hall da Fama — os recordes mundiais do jogo."),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const view = await viewRecords({ recordRepository: ctx.recordRepository, playerRepository: ctx.playerRepository });

    const lines =
      view.rows.length > 0
        ? view.rows.map(
            (row) => `**${RECORD_CATEGORY_LABELS[row.category]}** — ${row.holderNickname} (${row.value.toFixed(0)})`,
          )
        : ["Nenhum recorde foi estabelecido ainda."];

    const card = new ContainerBuilder()
      .setAccentColor(0xf1c40f)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🏆 Hall da Fama — recordes mundiais"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
