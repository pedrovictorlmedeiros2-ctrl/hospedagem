import { ComponentType, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { MatchTacticContext, ResolveMatchTactic } from "../../career/services/playCareerMatch.js";
import { playCareerMatch } from "../../career/services/playCareerMatch.js";
import type { MatchTacticChoice } from "../../game/domain/tactics.js";
import { buildCareerMatchResultCard } from "../ui/careerMatchResultCard.js";
import { MATCH_TACTIC_BUTTON_PREFIX, buildMatchTacticCard, type MatchTacticCardCopy } from "../ui/matchTacticCard.js";
import type { Command, CommandContext } from "./types.js";

/** No response in 5 minutes defaults to BALANCED (see buildMatchTacticCard's footer note) rather than leaving the match stuck mid-simulation forever. */
const TACTIC_DECISION_TIMEOUT_MS = 5 * 60 * 1000;

/** One factory shared by both pause points (halftime, late-game) — only the card's heading/prompt text differs between them. */
function makeResolveMatchTactic(
  interaction: ChatInputCommandInteraction,
  logger: CommandContext["logger"],
  copy: MatchTacticCardCopy,
): ResolveMatchTactic {
  return async (context: MatchTacticContext): Promise<MatchTacticChoice> => {
    const card = buildMatchTacticCard(context, copy);
    const message = await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    try {
      const buttonInteraction = await message.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith(MATCH_TACTIC_BUTTON_PREFIX),
        time: TACTIC_DECISION_TIMEOUT_MS,
      });
      // Acknowledges the click without changing the message yet — the
      // next card (the other pause point, or the final result) replaces
      // it via `interaction.editReply` right after playCareerMatch
      // resumes simulating.
      await buttonInteraction.deferUpdate();
      return buttonInteraction.customId.slice(MATCH_TACTIC_BUTTON_PREFIX.length) as MatchTacticChoice;
    } catch {
      logger.info({ discordId: interaction.user.id, minute: context.minute }, "match tactic decision timed out, defaulting to BALANCED");
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
        resolveHalftimeTactic: makeResolveMatchTactic(interaction, ctx.logger, {
          title: "⏸️ Intervalo",
          prompt: "Fim do primeiro tempo. Escolha a postura do seu time para os 45 minutos finais:",
        }),
        resolveLateGameTactic: makeResolveMatchTactic(interaction, ctx.logger, {
          title: "⏱️ Reta final",
          prompt: "Faltam 20 minutos. Confirma a postura ou muda de ideia para o resto do jogo:",
        }),
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
