import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { playCareerMatch } from "../../career/services/playCareerMatch.js";
import { buildCareerMatchResultCard } from "../ui/careerMatchResultCard.js";
import type { Command } from "./types.js";

export const jogarCarreiraCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("jogar-carreira")
    .setDescription("Joga a próxima partida da sua carreira pelo clube atual."),

  async execute(interaction, ctx) {
    await interaction.deferReply();

    const match = await playCareerMatch(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        careerRepository: ctx.careerRepository,
        matchRepository: ctx.matchRepository,
        events: ctx.events,
      },
      { discordId: interaction.user.id },
    );

    const card = buildCareerMatchResultCard(match);
    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    ctx.logger.info(
      {
        discordId: interaction.user.id,
        score: `${match.result.homeScore}-${match.result.awayScore}`,
        stage: match.newStage,
      },
      "career match played",
    );
  },
};
