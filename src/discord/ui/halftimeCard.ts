import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import type { HalftimeContext } from "../../career/services/playCareerMatch.js";
import { HALFTIME_TACTIC_DESCRIPTIONS, HALFTIME_TACTIC_LABELS, type HalftimeTacticChoice } from "../../game/domain/tactics.js";

/** Prefix + choice is the whole customId — the collector is scoped to this exact message (see jogarCarreira.ts), so there's no need to encode a session id. */
export const HALFTIME_BUTTON_PREFIX = "halftime-tactic:";

export function halftimeButtonCustomId(choice: HalftimeTacticChoice): string {
  return `${HALFTIME_BUTTON_PREFIX}${choice}`;
}

const CHOICES: HalftimeTacticChoice[] = ["DEFENSIVE", "BALANCED", "OFFENSIVE"];

export function buildHalftimeCard(context: HalftimeContext): ContainerBuilder {
  const homeName = context.playerSide === "home" ? context.clubName : context.opponentName;
  const awayName = context.playerSide === "home" ? context.opponentName : context.clubName;

  const lines = [
    `**${homeName} ${context.homeScore} x ${context.awayScore} ${awayName}**`,
    "Fim do primeiro tempo. Escolha a postura do seu time para os 45 minutos finais:",
    ...CHOICES.map((choice) => `${HALFTIME_TACTIC_LABELS[choice]} — ${HALFTIME_TACTIC_DESCRIPTIONS[choice]}`),
    "_Sem resposta em 5 minutos, o time segue **Equilibrado**._",
  ];

  const buttons = CHOICES.map((choice) =>
    new ButtonBuilder()
      .setCustomId(halftimeButtonCustomId(choice))
      .setLabel(HALFTIME_TACTIC_LABELS[choice])
      .setStyle(choice === "BALANCED" ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  return new ContainerBuilder()
    .setAccentColor(0xf1c40f)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### ⏸️ Intervalo"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")))
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
}
