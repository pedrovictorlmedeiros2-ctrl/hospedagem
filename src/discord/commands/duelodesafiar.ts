import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { DUEL_TIER_EMOJI, DUEL_TIER_LABELS } from "../../multiplayer/domain/labels.js";
import { challengeToDuel } from "../../multiplayer/services/challengeToDuel.js";
import type { Command } from "./types.js";

export const duelodesafiarCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("duelo-desafiar")
    .setDescription("Desafia outro jogador para um duelo 1x1.")
    .addUserOption((opt) => opt.setName("usuario").setDescription("Quem você quer desafiar").setRequired(true)),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const opponent = interaction.options.getUser("usuario", true);

    const { duel } = await challengeToDuel(
      { userRepository: ctx.userRepository, playerRepository: ctx.playerRepository, duelRepository: ctx.duelRepository },
      { discordId: interaction.user.id, opponentDiscordId: opponent.id },
    );

    const card = new ContainerBuilder()
      .setAccentColor(0x3498db)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("### ⚔️ Duelo enviado!"))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `Você desafiou **${opponent.username}** para um duelo.`,
            `${DUEL_TIER_EMOJI[duel.tier]} Tier: ${DUEL_TIER_LABELS[duel.tier]}`,
            `${opponent.username} pode responder com \`/duelo-responder\`.`,
          ].join("\n"),
        ),
      );

    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
