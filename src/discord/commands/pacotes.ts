import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { listPacks } from "../../cards/services/listPacks.js";
import type { Command } from "./types.js";

export const pacotesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("pacotes")
    .setDescription("Mostra os pacotes de cartas disponíveis para comprar."),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { packs } = await listPacks({ cardRepository: ctx.cardRepository });

    const lines = packs.map(
      (pack) =>
        `**${pack.name}** — ${pack.priceCoins ?? "?"} coins • ${pack.cardCount} cartas\n${pack.description ?? ""}`,
    );

    const card = new ContainerBuilder()
      .setAccentColor(0xe67e22)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🎴 Pacotes de cartas"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n\n")))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Use `/abrir-pacote` para comprar e abrir um pacote."),
      );

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
