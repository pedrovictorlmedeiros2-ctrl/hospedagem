import { ContainerBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder } from "discord.js";
import { viewNews } from "../../narrative/services/viewNews.js";
import type { Command } from "./types.js";

export const noticiasCommand: Command = {
  data: new SlashCommandBuilder().setName("noticias").setDescription("Mostra as últimas notícias do mundo do jogo."),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const view = await viewNews({ newsRepository: ctx.newsRepository });

    const container = new ContainerBuilder()
      .setAccentColor(0x3498db)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 📰 Últimas notícias"));

    if (view.rows.length === 0) {
      container
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Nenhuma notícia foi publicada ainda."));
    } else {
      for (const [index, row] of view.rows.entries()) {
        if (index > 0) container.addSeparatorComponents(new SeparatorBuilder());
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${row.headline}**\n${row.body}`));
      }
    }

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
