import { ContainerBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder } from "discord.js";
import { toggleFavoriteCard } from "../../cards/services/toggleFavoriteCard.js";
import type { Command } from "./types.js";

export const favoritarCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("favoritar")
    .setDescription("Favorita ou desfavorita uma carta da sua coleção.")
    .addStringOption((opt) => opt.setName("nome").setDescription("Nome exato da carta").setRequired(true)),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const cardName = interaction.options.getString("nome", true);

    const result = await toggleFavoriteCard(
      { userRepository: ctx.userRepository, cardRepository: ctx.cardRepository },
      { discordId: interaction.user.id, cardName },
    );

    const message = result.isFavorite
      ? `⭐ **${result.card.name}** agora está favoritada.`
      : `${result.card.name} não está mais favoritada.`;

    const container = new ContainerBuilder()
      .setAccentColor(0x1abc9c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🎴 Favoritos"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(message));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
