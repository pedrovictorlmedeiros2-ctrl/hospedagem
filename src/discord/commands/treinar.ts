import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { INTENSIVE_TRAINING_COST_COINS, TRAINING_FOCUS_LABELS, type TrainingFocus } from "../../career/domain/training.js";
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
    )
    .addBooleanOption((opt) =>
      opt
        .setName("intensivo")
        .setDescription(`Treino intensivo: dobra o ganho por ${INTENSIVE_TRAINING_COST_COINS} coins (mesmo cooldown)`)
        .setRequired(false),
    ),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const focus = interaction.options.getString("foco", true) as TrainingFocus;
    const intensive = interaction.options.getBoolean("intensivo") ?? false;

    const { player, gainedPoints, coinsSpent } = await trainPlayer(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        trainingRepository: ctx.trainingRepository,
        walletRepository: ctx.walletRepository,
      },
      { discordId: interaction.user.id, focus, intensive },
    );

    const lines = [
      `Foco: **${TRAINING_FOCUS_LABELS[focus]}** (+${gainedPoints})`,
      `**OVR ${player.overall}** • Estamina ${player.stamina}/100`,
    ];
    if (coinsSpent > 0) {
      lines.push(`🪙 Treino intensivo: -${coinsSpent} coins`);
    }

    const card = new ContainerBuilder()
      .setAccentColor(0x2ecc71)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🏋️ Treino concluído"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
