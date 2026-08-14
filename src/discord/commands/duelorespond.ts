import { ContainerBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder } from "discord.js";
import { respondToDuel } from "../../multiplayer/services/respondToDuel.js";
import { buildDuelResultCard } from "../ui/duelResultCard.js";
import type { Command } from "./types.js";

export const duelorespondCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("duelo-responder")
    .setDescription("Aceita ou recusa um desafio de duelo recebido.")
    .addUserOption((opt) => opt.setName("desafiante").setDescription("Quem te desafiou").setRequired(true))
    .addBooleanOption((opt) => opt.setName("aceitar").setDescription("Aceitar o desafio?").setRequired(true)),

  async execute(interaction, ctx) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const challenger = interaction.options.getUser("desafiante", true);
    const accept = interaction.options.getBoolean("aceitar", true);

    const result = await respondToDuel(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        duelRepository: ctx.duelRepository,
        walletRepository: ctx.walletRepository,
        recordRepository: ctx.recordRepository,
        rivalryRepository: ctx.rivalryRepository,
        achievementRepository: ctx.achievementRepository,
        events: ctx.events,
      },
      { discordId: interaction.user.id, challengerDiscordId: challenger.id, accept },
    );

    if (!result.accepted) {
      const card = new ContainerBuilder()
        .setAccentColor(0x95a5a6)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("### ⚔️ Duelo recusado"))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`Você recusou o desafio de **${challenger.username}**.`),
        );
      await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
      return;
    }

    const winnerName =
      result.winnerDiscordId === challenger.id
        ? challenger.username
        : result.winnerDiscordId === interaction.user.id
          ? interaction.user.username
          : null;

    const card = buildDuelResultCard(result, challenger.username, interaction.user.username, winnerName);
    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    ctx.logger.info(
      { discordId: interaction.user.id, challengerDiscordId: challenger.id, outcome: result.outcome },
      "duel resolved",
    );
  },
};
