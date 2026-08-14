import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { viewContract } from "../../economy/services/viewContract.js";
import type { Command } from "./types.js";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const contratoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("contrato")
    .setDescription("Mostra seu contrato atual: salário, cláusula de rescisão e validade."),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const view = await viewContract(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        careerRepository: ctx.careerRepository,
        marketRepository: ctx.marketRepository,
      },
      { discordId: interaction.user.id },
    );

    const lines = [
      `Clube: **${view.clubName}**`,
      `Salário: **${view.contract.salary} coins/partida**`,
      `Cláusula de rescisão: **${view.contract.releaseClause} coins**`,
      `Valor de mercado estimado: **${view.marketValue} coins**`,
      `Contrato válido até: **${formatDate(view.contract.endsAt)}**`,
    ];

    const card = new ContainerBuilder()
      .setAccentColor(0x3498db)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 📄 Contrato"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
