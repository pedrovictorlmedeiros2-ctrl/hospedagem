import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { listTransferOffers } from "../../economy/services/listTransferOffers.js";
import type { Command } from "./types.js";

export const propostasCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("propostas")
    .setDescription("Mostra propostas de transferência de outros clubes da sua liga."),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const view = await listTransferOffers(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        careerRepository: ctx.careerRepository,
      },
      { discordId: interaction.user.id },
    );

    const lines =
      view.offers.length > 0
        ? view.offers.map((offer) => `**${offer.clubName}** — proposta de ${offer.fee} coins`)
        : ["Nenhum clube quer te contratar hoje. Continue evoluindo e volte amanhã."];

    const card = new ContainerBuilder()
      .setAccentColor(0x9b59b6)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 📋 Propostas de transferência"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Clube atual: **${view.currentClubName}**`))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

    if (view.offers.length > 0) {
      card
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("Use `/transferir clube:<nome>` para aceitar uma proposta."),
        );
    }

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
