import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { viewCareer } from "../../career/services/viewCareer.js";
import { buildCareerCard } from "../ui/careerCard.js";
import type { Command } from "./types.js";

export const carreiraCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("carreira")
    .setDescription("Mostra o status da sua carreira."),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const view = await viewCareer(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        careerRepository: ctx.careerRepository,
        matchRepository: ctx.matchRepository,
      },
      { discordId: interaction.user.id },
    );

    const card = buildCareerCard(view);
    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
