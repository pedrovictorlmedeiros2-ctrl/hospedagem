import { ComponentType, MessageFlags, SlashCommandBuilder, type RepliableInteraction } from "discord.js";
import type {
  MatchTacticContext,
  PenaltyDecisionContext,
  ResolveMatchTactic,
  ResolvePenaltyDecision,
  ResolveSubstitutionDecision,
  SubstitutionDecisionContext,
} from "../../career/services/playCareerMatch.js";
import { playCareerMatch } from "../../career/services/playCareerMatch.js";
import type { PenaltyChoice } from "../../game/domain/penaltyDecision.js";
import type { MatchTacticChoice } from "../../game/domain/tactics.js";
import { buildCareerMatchResultCard } from "../ui/careerMatchResultCard.js";
import { MATCH_TACTIC_BUTTON_PREFIX, buildMatchTacticCard, type MatchTacticCardCopy } from "../ui/matchTacticCard.js";
import { PENALTY_BUTTON_PREFIX, buildPenaltyDecisionCard, parsePenaltyButtonCustomId } from "../ui/penaltyDecisionCard.js";
import {
  SUBSTITUTION_BUTTON_PREFIX,
  buildSubstitutionDecisionCard,
  parseSubstitutionButtonCustomId,
} from "../ui/substitutionDecisionCard.js";
import type { Command, CommandContext } from "./types.js";

/** No response in 5 minutes defaults to BALANCED (see buildMatchTacticCard's footer note) rather than leaving the match stuck mid-simulation forever. */
const TACTIC_DECISION_TIMEOUT_MS = 5 * 60 * 1000;
/** Same timeout budget as the tactic decisions — see buildPenaltyDecisionCard's footer note for the default (center, placed). */
const PENALTY_DECISION_TIMEOUT_MS = 5 * 60 * 1000;
/** Same timeout budget as the other decisions — see buildSubstitutionDecisionCard's footer note for the default (freshest same-position bench player). */
const SUBSTITUTION_DECISION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * One factory shared by both pause points (halftime, late-game) — only the
 * card's heading/prompt text differs between them. `timedOutMinutes` is a
 * shared, mutated-in-place array the caller also passes to the result
 * card, so a silent timeout (no message of its own — see
 * buildMatchTacticCard's footer note) still shows up as a note on the
 * final result instead of vanishing without a trace.
 */
function makeResolveMatchTactic(
  interaction: RepliableInteraction,
  logger: CommandContext["logger"],
  copy: MatchTacticCardCopy,
  timedOutMinutes: number[],
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
      timedOutMinutes.push(context.minute);
      return "BALANCED";
    }
  };
}

/**
 * Same pause/wait/timeout shape as makeResolveMatchTactic, but for a
 * penalty — fires at whatever minute the penalty actually happens,
 * unlike the two fixed tactic checkpoints. `penaltyTimeoutMinutes` mirrors
 * `timedOutMinutes` for tactics but stays a separate array since the
 * footer note reads differently (see careerMatchResultCard.ts).
 */
function makeResolvePenaltyDecision(
  interaction: RepliableInteraction,
  logger: CommandContext["logger"],
  penaltyTimeoutMinutes: number[],
): ResolvePenaltyDecision {
  return async (context: PenaltyDecisionContext): Promise<PenaltyChoice> => {
    const card = buildPenaltyDecisionCard(context);
    const message = await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    try {
      const buttonInteraction = await message.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith(PENALTY_BUTTON_PREFIX),
        time: PENALTY_DECISION_TIMEOUT_MS,
      });
      await buttonInteraction.deferUpdate();
      return parsePenaltyButtonCustomId(buttonInteraction.customId);
    } catch {
      logger.info({ discordId: interaction.user.id, minute: context.minute }, "penalty decision timed out, defaulting to center/placed");
      penaltyTimeoutMinutes.push(context.minute);
      return { corner: "CENTER", power: "PLACED" };
    }
  };
}

/**
 * Same pause/wait/timeout shape as makeResolvePenaltyDecision, but for a
 * stamina substitution — fires at whatever minute a tired player is found
 * on the pitch. `substitutionTimeoutMinutes` mirrors `penaltyTimeoutMinutes`
 * for its own footer note (see careerMatchResultCard.ts). On timeout returns
 * "" — an id that never matches a real bench player, which
 * resumePendingSubstitution (game/engine/simulateMatch.ts) treats the same
 * as an omitted choice: falls back to pickReplacement's automatic pick
 * (freshest same-position bench player), not necessarily benchOptions[0].
 */
function makeResolveSubstitutionDecision(
  interaction: RepliableInteraction,
  logger: CommandContext["logger"],
  substitutionTimeoutMinutes: number[],
): ResolveSubstitutionDecision {
  return async (context: SubstitutionDecisionContext): Promise<string> => {
    const card = buildSubstitutionDecisionCard(context);
    const message = await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

    try {
      const buttonInteraction = await message.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith(SUBSTITUTION_BUTTON_PREFIX),
        time: SUBSTITUTION_DECISION_TIMEOUT_MS,
      });
      await buttonInteraction.deferUpdate();
      return parseSubstitutionButtonCustomId(buttonInteraction.customId);
    } catch {
      logger.info({ discordId: interaction.user.id, minute: context.minute }, "substitution decision timed out, defaulting to automatic pick");
      substitutionTimeoutMinutes.push(context.minute);
      return "";
    }
  };
}

/** Shared by the slash command and the /menu button (see discord/menuActions.ts) — identical result either way, including the two interactive tactic pauses. */
export async function renderJogarCarreira(interaction: RepliableInteraction, ctx: CommandContext): Promise<void> {
  await interaction.deferReply();

  const timedOutMinutes: number[] = [];
  const penaltyTimeoutMinutes: number[] = [];
  const substitutionTimeoutMinutes: number[] = [];
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
      resolveHalftimeTactic: makeResolveMatchTactic(
        interaction,
        ctx.logger,
        { title: "⏸️ Intervalo", prompt: "Fim do primeiro tempo. Escolha a postura do seu time para os 45 minutos finais:" },
        timedOutMinutes,
      ),
      resolveLateGameTactic: makeResolveMatchTactic(
        interaction,
        ctx.logger,
        { title: "⏱️ Reta final", prompt: "Faltam 20 minutos. Confirma a postura ou muda de ideia para o resto do jogo:" },
        timedOutMinutes,
      ),
      resolvePenaltyDecision: makeResolvePenaltyDecision(interaction, ctx.logger, penaltyTimeoutMinutes),
      resolveSubstitutionDecision: makeResolveSubstitutionDecision(interaction, ctx.logger, substitutionTimeoutMinutes),
    },
    { discordId: interaction.user.id },
  );

  const card = buildCareerMatchResultCard(match, { timedOutMinutes, penaltyTimeoutMinutes, substitutionTimeoutMinutes });
  await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

  ctx.logger.info(
    {
      discordId: interaction.user.id,
      score: `${match.result.homeScore}-${match.result.awayScore}`,
      stage: match.newStage,
    },
    "career match played",
  );
}

export const jogarCarreiraCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("jogar-carreira")
    .setDescription("Joga a próxima partida da sua carreira pelo clube atual."),

  execute: renderJogarCarreira,
};
