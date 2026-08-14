import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { playFriendlyMatch } from "../../game/services/playFriendlyMatch.js";
import { buildMatchResultCard } from "../ui/matchResultCard.js";
import type { Command } from "./types.js";

export const simularAmistosoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("simular-amistoso")
    .setDescription(
      "Simula uma partida amistosa do seu jogador (núcleo do motor de partida — fase de testes).",
    ),

  async execute(interaction, ctx) {
    await interaction.deferReply();

    const { result, home, away } = await playFriendlyMatch(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        events: ctx.events,
      },
      { discordId: interaction.user.id },
    );

    const card = buildMatchResultCard(result, home, away);
    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    ctx.logger.info(
      {
        discordId: interaction.user.id,
        seed: result.seed,
        score: `${result.homeScore}-${result.awayScore}`,
      },
      "friendly match simulated",
    );
  },
};
