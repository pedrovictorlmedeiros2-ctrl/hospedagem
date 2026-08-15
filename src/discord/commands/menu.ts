import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { buildMenuCard } from "../ui/menuCard.js";
import type { Command } from "./types.js";

export const menuCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("menu")
    .setDescription("Abre um painel com botões pras ações mais usadas do jogo."),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const card = buildMenuCard();
    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
  },
};
