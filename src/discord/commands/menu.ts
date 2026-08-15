import { MessageFlags, SlashCommandBuilder, type RepliableInteraction } from "discord.js";
import { buildMenuCard } from "../ui/menuCard.js";
import type { Command, CommandContext } from "./types.js";

/** Shared by the slash command and the "🏠 Menu" shortcut button on result cards (see discord/menuActions.ts). */
export async function renderMenu(interaction: RepliableInteraction, _ctx: CommandContext): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const card = buildMenuCard();
  await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
}

export const menuCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("menu")
    .setDescription("Abre um painel com botões pras ações mais usadas do jogo."),

  execute: renderMenu,
};
