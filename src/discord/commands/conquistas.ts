import { ContainerBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder } from "discord.js";
import { viewAchievements } from "../../achievements/services/viewAchievements.js";
import type { Command } from "./types.js";

export const conquistasCommand: Command = {
  data: new SlashCommandBuilder().setName("conquistas").setDescription("Mostra seu progresso de conquistas."),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const view = await viewAchievements(
      { userRepository: ctx.userRepository, achievementRepository: ctx.achievementRepository },
      { discordId: interaction.user.id },
    );

    const lines = view.rows.map((row) => {
      const marker = row.unlocked ? "✅" : "🔒";
      return `${marker} **${row.name}** — ${row.description}`;
    });

    const container = new ContainerBuilder()
      .setAccentColor(0xf1c40f)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### 🏅 Conquistas — ${view.unlockedCount}/${view.totalCount}`),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
