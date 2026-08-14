import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { TRAINING_FOCUS_LABELS, type TrainingFocus } from "../../career/domain/training.js";
import { trainPlayer } from "../../career/services/trainPlayer.js";
import type { Command } from "./types.js";

const focusChoices = Object.entries(TRAINING_FOCUS_LABELS).map(([value, name]) => ({
  name,
  value,
}));

export const treinarCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("treinar")
    .setDescription("Treina um atributo do seu jogador (uma sessão por dia).")
    .addStringOption((opt) =>
      opt
        .setName("foco")
        .setDescription("Atributo a treinar")
        .setRequired(true)
        .addChoices(...focusChoices),
    ),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const focus = interaction.options.getString("foco", true) as TrainingFocus;

    const { player, gainedPoints } = await trainPlayer(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        trainingRepository: ctx.trainingRepository,
      },
      { discordId: interaction.user.id, focus },
    );

    const card = new ContainerBuilder()
      .setAccentColor(0x2ecc71)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🏋️ Treino concluído"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `Foco: **${TRAINING_FOCUS_LABELS[focus]}** (+${gainedPoints})`,
            `**OVR ${player.overall}** • Estamina ${player.stamina}/100`,
          ].join("\n"),
        ),
      );

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
