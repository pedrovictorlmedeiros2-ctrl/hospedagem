import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type RepliableInteraction,
} from "discord.js";
import { CARD_RARITY_EMOJI } from "../../cards/domain/labels.js";
import { viewCollection } from "../../cards/services/viewCollection.js";
import type { Command, CommandContext } from "./types.js";

export async function renderColecao(interaction: RepliableInteraction, ctx: CommandContext): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const view = await viewCollection(
    { userRepository: ctx.userRepository, cardRepository: ctx.cardRepository },
    { discordId: interaction.user.id },
  );

  const lines =
    view.entries.length > 0
      ? view.entries.map(
          (entry) =>
            `${CARD_RARITY_EMOJI[entry.card.rarity]} **${entry.card.name}** (${entry.card.position}, OVR ${entry.card.overall})${entry.count > 1 ? ` ×${entry.count}` : ""}`,
        )
      : ["Você ainda não tem nenhuma carta. Use /pacotes e /abrir-pacote para começar sua coleção."];

  const card = new ContainerBuilder()
    .setAccentColor(0x1abc9c)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🗂️ Sua coleção"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Total de cartas: **${view.totalCards}**`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

  await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
}

export const colecaoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("colecao")
    .setDescription("Mostra sua coleção de cartas."),

  execute: renderColecao,
};
