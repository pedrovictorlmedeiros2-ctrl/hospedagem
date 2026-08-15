import { MessageFlags, SlashCommandBuilder, type RepliableInteraction } from "discord.js";
import { viewStandings } from "../../career/services/viewStandings.js";
import { buildStandingsCard } from "../ui/standingsCard.js";
import type { Command, CommandContext } from "./types.js";

export async function renderClassificacao(interaction: RepliableInteraction, ctx: CommandContext): Promise<void> {
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
}

export const classificacaoCommand: Command = {
  data: new SlashCommandBuilder().setName("classificacao").setDescription("Mostra a tabela da sua liga."),

  execute: renderClassificacao,
};
