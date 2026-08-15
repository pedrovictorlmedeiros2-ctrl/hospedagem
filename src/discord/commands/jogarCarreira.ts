import { ComponentType, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { HalftimeContext, ResolveHalftimeTactic } from "../../career/services/playCareerMatch.js";
import { playCareerMatch } from "../../career/services/playCareerMatch.js";
import type { HalftimeTacticChoice } from "../../game/domain/tactics.js";
import { buildCareerMatchResultCard } from "../ui/careerMatchResultCard.js";
import { HALFTIME_BUTTON_PREFIX, buildHalftimeCard } from "../ui/halftimeCard.js";
import type { Command, CommandContext } from "./types.js";

/** No response in 5 minutes defaults to BALANCED (see buildHalftimeCard's footer note) rather than leaving the match stuck mid-simulation forever. */
const HALFTIME_TIMEOUT_MS = 5 * 60 * 1000;

function makeResolveHalftimeTactic(
  interaction: ChatInputCommandInteraction,
  logger: CommandContext["logger"],
): ResolveHalftimeTactic {
  return async (context: HalftimeContext): Promise<HalftimeTacticChoice> => {
    const card = buildHalftimeCard(context);
    const message = await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    try {
      const buttonInteraction = await message.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith(HALFTIME_BUTTON_PREFIX),
        time: HALFTIME_TIMEOUT_MS,
      });
      // Acknowledges the click without changing the message yet — the
      // final result card replaces it via `interaction.editReply` right
      // after playCareerMatch resumes and finishes the second half.
      await buttonInteraction.deferUpdate();
      return buttonInteraction.customId.slice(HALFTIME_BUTTON_PREFIX.length) as HalftimeTacticChoice;
    } catch {
      logger.info({ discordId: interaction.user.id }, "halftime tactic timed out, defaulting to BALANCED");
      return "BALANCED";
    }
  };
}

export const jogarCarreiraCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("jogar-carreira")
    .setDescription("Joga a próxima partida da sua carreira pelo clube atual."),

  async execute(interaction, ctx) {
    await interaction.deferReply();

    const match = await playCareerMatch(
      {
        userRepository: ctx.userRepository,
        playerRepository: ctx.playerRepository,
        careerRepository: ctx.careerRepository,
        competitionRepository: ctx.competitionRepository,
        matchRepository: ctx.matchRepository,
        walletRepository: ctx.walletRepository,
        marketRepository: ctx.marketRepository,
        recordRepository: ctx.recordRepository,
        achievementRepository: ctx.achievementRepository,
        events: ctx.events,
        resolveHalftimeTactic: makeResolveHalftimeTactic(interaction, ctx.logger),
      },
      { discordId: interaction.user.id },
    );

    const card = buildCareerMatchResultCard(match);
    await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    ctx.logger.info(
      {
        discordId: interaction.user.id,
        score: `${match.result.homeScore}-${match.result.awayScore}`,
        stage: match.newStage,
      },
      "career match played",
    );
  },
};
