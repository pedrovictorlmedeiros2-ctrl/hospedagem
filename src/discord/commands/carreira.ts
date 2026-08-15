import { MessageFlags, SlashCommandBuilder, type RepliableInteraction } from "discord.js";
import { viewCareer } from "../../career/services/viewCareer.js";
import { buildCareerCard } from "../ui/careerCard.js";
import type { Command, CommandContext } from "./types.js";

/** Shared by the slash command and the /menu button (see discord/menuActions.ts) — identical result either way. */
export async function renderCareira(interaction: RepliableInteraction, ctx: CommandContext): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const view = await viewCareer(
    {
      userRepository: ctx.userRepository,
      playerRepository: ctx.playerRepository,
      careerRepository: ctx.careerRepository,
      matchRepository: ctx.matchRepository,
    },
    { discordId: interaction.user.id },
  );

  const card = buildCareerCard(view);
  await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
}

export const carreiraCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("carreira")
    .setDescription("Mostra o status da sua carreira."),

  execute: renderCareira,
};
