import { MessageFlags, SlashCommandBuilder, type RepliableInteraction } from "discord.js";
import { playCupMatch } from "../../career/services/playCupMatch.js";
import { viewCupHistory } from "../../career/services/viewCupHistory.js";
import { buildCupCard } from "../ui/cupCard.js";
import type { Command, CommandContext } from "./types.js";

/** Shared by the slash command and the /menu button (see discord/menuActions.ts). */
export async function renderCopa(interaction: RepliableInteraction, ctx: CommandContext): Promise<void> {
  await interaction.deferReply();

  const cupDeps = {
    userRepository: ctx.userRepository,
    playerRepository: ctx.playerRepository,
    careerRepository: ctx.careerRepository,
    cupRepository: ctx.cupRepository,
  };

  const match = await playCupMatch(
    { ...cupDeps, matchRepository: ctx.matchRepository, walletRepository: ctx.walletRepository, events: ctx.events },
    { discordId: interaction.user.id },
  );
  const { entries: history } = await viewCupHistory(cupDeps, { discordId: interaction.user.id });

  const card = buildCupCard(match, history);
  await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

  ctx.logger.info(
    { discordId: interaction.user.id, played: match.played, champion: match.championTeamName },
    "cup match checked/played",
  );
}

export const copaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("copa")
    .setDescription("Joga a próxima partida da copa mata-mata (ou mostra a chave atual)."),

  execute: renderCopa,
};
