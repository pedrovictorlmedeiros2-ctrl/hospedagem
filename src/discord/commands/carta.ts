import { ContainerBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder } from "discord.js";
import { CARD_ATTRIBUTE_LABELS, CARD_RARITY_EMOJI, CARD_RARITY_LABELS } from "../../cards/domain/labels.js";
import { viewCardDetail } from "../../cards/services/viewCardDetail.js";
import type { Command } from "./types.js";

export const cartaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("carta")
    .setDescription("Mostra a visão detalhada de uma carta do catálogo.")
    .addStringOption((opt) => opt.setName("nome").setDescription("Nome exato da carta").setRequired(true)),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const cardName = interaction.options.getString("nome", true);

    const view = await viewCardDetail(
      { userRepository: ctx.userRepository, cardRepository: ctx.cardRepository },
      { discordId: interaction.user.id, cardName },
    );
    const { card } = view;

    const attributeLines = Object.entries(card.attributes).map(
      ([key, value]) => `${CARD_ATTRIBUTE_LABELS[key] ?? key}: **${value}**`,
    );

    const summaryLines = [
      `${CARD_RARITY_EMOJI[card.rarity]} ${CARD_RARITY_LABELS[card.rarity]} • ${card.position} • OVR ${card.overall}`,
      card.ability ? `✨ Habilidade: ${card.ability}` : null,
      view.ownedCount > 0
        ? `Você tem ${view.ownedCount} cópia(s)${view.hasFavorite ? " • ⭐ favoritada" : ""}.`
        : "Você ainda não tem essa carta.",
    ].filter((line): line is string => line !== null);

    const container = new ContainerBuilder()
      .setAccentColor(0x1abc9c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🎴 ${card.name}`))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(summaryLines.join("\n")))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(attributeLines.join("\n")));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
