import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { setGuildEventsChannel } from "../../events/services/setGuildEventsChannel.js";
import type { Command, CommandContext } from "./types.js";

export const canalEventosCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("canal-eventos")
    .setDescription("Define este canal para receber notificações de eventos do jogo (ex: recordes mundiais quebrados).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "⚠️ Esse comando só funciona dentro de um servidor, não em mensagem direta.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await setGuildEventsChannel(
      { guildEventChannelRepository: ctx.guildEventChannelRepository },
      { guildId: interaction.guildId, channelId: interaction.channelId },
    );

    await interaction.reply({
      content: "✅ Prontinho! Eventos do jogo (recordes mundiais quebrados, etc) serão publicados aqui a partir de agora.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
