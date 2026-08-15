import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import type { MatchTacticContext } from "../../career/services/playCareerMatch.js";
import { MATCH_TACTIC_DESCRIPTIONS, MATCH_TACTIC_LABELS, type MatchTacticChoice } from "../../game/domain/tactics.js";

/** Prefix + choice is the whole customId — the collector is scoped to this exact message (see jogarCarreira.ts), so there's no need to encode which pause point or session this is. */
export const MATCH_TACTIC_BUTTON_PREFIX = "match-tactic:";

export function matchTacticButtonCustomId(choice: MatchTacticChoice): string {
  return `${MATCH_TACTIC_BUTTON_PREFIX}${choice}`;
}

const CHOICES: MatchTacticChoice[] = ["DEFENSIVE", "BALANCED", "OFFENSIVE"];

export interface MatchTacticCardCopy {
  /** Heading, e.g. "⏸️ Intervalo" or "⏱️ Reta final". */
  title: string;
  /** What's being asked, e.g. "Escolha a postura do seu time para os 45 minutos finais:". */
  prompt: string;
}

export function buildMatchTacticCard(context: MatchTacticContext, copy: MatchTacticCardCopy): ContainerBuilder {
  const homeName = context.playerSide === "home" ? context.clubName : context.opponentName;
  const awayName = context.playerSide === "home" ? context.opponentName : context.clubName;

  const lines = [
    `**${homeName} ${context.homeScore} x ${context.awayScore} ${awayName}**`,
    copy.prompt,
    ...CHOICES.map((choice) => `${MATCH_TACTIC_LABELS[choice]} — ${MATCH_TACTIC_DESCRIPTIONS[choice]}`),
    "_Sem resposta em 5 minutos, o time segue **Equilibrado**._",
  ];

  const buttons = CHOICES.map((choice) =>
    new ButtonBuilder()
      .setCustomId(matchTacticButtonCustomId(choice))
      .setLabel(MATCH_TACTIC_LABELS[choice])
      .setStyle(choice === "BALANCED" ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  return new ContainerBuilder()
    .setAccentColor(0xf1c40f)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${copy.title}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")))
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
}
