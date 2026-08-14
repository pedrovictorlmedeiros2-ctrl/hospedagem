import { ContainerBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder } from "discord.js";
import { viewRanking } from "../../global/services/viewRanking.js";
import type { Command } from "./types.js";

export const rankingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("Mostra o ranking global de jogadores.")
    .addStringOption((opt) =>
      opt
        .setName("metrica")
        .setDescription("Por qual critério ordenar")
        .setRequired(false)
        .addChoices({ name: "Rating (ELO)", value: "GLOBAL_RATING" }, { name: "Overall (OVR)", value: "OVERALL" }),
    ),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const metric = (interaction.options.getString("metrica") ?? "GLOBAL_RATING") as "GLOBAL_RATING" | "OVERALL";

    const view = await viewRanking({ playerRepository: ctx.playerRepository }, { metric });

    const label = metric === "GLOBAL_RATING" ? "Rating" : "OVR";
    const lines =
      view.rows.length > 0
        ? view.rows.map((row) => `**${row.rank}.** ${row.nickname} — ${row.value.toFixed(0)} ${label}`)
        : ["Ainda não há jogadores suficientes pra formar um ranking."];

    const card = new ContainerBuilder()
      .setAccentColor(0xf1c40f)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🏆 Ranking global — ${label}`))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
