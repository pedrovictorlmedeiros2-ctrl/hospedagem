import { ContainerBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder } from "discord.js";
import { askCoach } from "../../narrative/services/askCoach.js";
import type { Command } from "./types.js";

export const treinadorCommand: Command = {
  data: new SlashCommandBuilder().setName("treinador").setDescription("Peça um conselho ao técnico sobre sua temporada."),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { message } = await askCoach(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        careerRepository: ctx.careerRepository,
        matchRepository: ctx.matchRepository,
        narrativeGenerator: ctx.narrativeGenerator,
      },
      { discordId: interaction.user.id },
    );

    const card = new ContainerBuilder()
      .setAccentColor(0x2ecc71)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🧑‍💼 Seu técnico diz"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(message));

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
