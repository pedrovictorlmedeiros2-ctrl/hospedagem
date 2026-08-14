import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { acceptTransferOffer } from "../../economy/services/acceptTransferOffer.js";
import type { Command } from "./types.js";

export const transferirCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("transferir")
    .setDescription("Aceita uma proposta de transferência de um clube (veja /propostas).")
    .addStringOption((opt) =>
      opt.setName("clube").setDescription("Nome do clube (exatamente como aparece em /propostas)").setRequired(true),
    ),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const toClubName = interaction.options.getString("clube", true);

    const result = await acceptTransferOffer(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        careerRepository: ctx.careerRepository,
        marketRepository: ctx.marketRepository,
        walletRepository: ctx.walletRepository,
      },
      { discordId: interaction.user.id, toClubName },
    );

    const lines = [
      `Você saiu do **${result.fromClubName}** e assinou com o **${result.toClubName}**!`,
      `Taxa de transferência negociada: ${result.fee} coins`,
      `🪙 Bônus de assinatura: +${result.signingBonus} coins`,
      `Novo salário: ${result.newSalary} coins/partida`,
    ];

    const card = new ContainerBuilder()
      .setAccentColor(0x2ecc71)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🔄 Transferência concluída"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    ctx.logger.info(
      { discordId: interaction.user.id, fromClub: result.fromClubName, toClub: result.toClubName, fee: result.fee },
      "player transferred clubs",
    );
  },
};
