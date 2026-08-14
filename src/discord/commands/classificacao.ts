import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { viewStandings } from "../../career/services/viewStandings.js";
import { buildStandingsCard } from "../ui/standingsCard.js";
import type { Command } from "./types.js";

export const classificacaoCommand: Command = {
  data: new SlashCommandBuilder().setName("classificacao").setDescription("Mostra a tabela da sua liga."),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const view = await viewStandings(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        careerRepository: ctx.careerRepository,
        competitionRepository: ctx.competitionRepository,
      },
      { discordId: interaction.user.id },
    );

    const card = buildStandingsCard(view);
    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
