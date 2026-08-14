import { ContainerBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder } from "discord.js";
import { viewRivalry } from "../../global/services/viewRivalry.js";
import type { Command } from "./types.js";

export const rivalidadeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("rivalidade")
    .setDescription("Mostra o histórico de confrontos contra outro jogador.")
    .addUserOption((opt) => opt.setName("usuario").setDescription("Contra quem você quer ver o histórico").setRequired(true)),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const opponent = interaction.options.getUser("usuario", true);

    const view = await viewRivalry(
      { userRepository: ctx.userRepository, playerRepository: ctx.playerRepository, rivalryRepository: ctx.rivalryRepository },
      { discordId: interaction.user.id, opponentDiscordId: opponent.id },
    );

    const summaryLines = [
      `Você **${view.myWins}** x **${view.opponentWins}** ${view.opponentNickname}`,
      view.lastMatchAt ? `Último confronto: ${view.lastMatchAt.toLocaleDateString("pt-BR")}` : "Vocês ainda não se enfrentaram.",
    ];

    const card = new ContainerBuilder()
      .setAccentColor(0x9b59b6)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🔥 Rivalidade — você x ${view.opponentNickname}`))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(summaryLines.join("\n")));

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
