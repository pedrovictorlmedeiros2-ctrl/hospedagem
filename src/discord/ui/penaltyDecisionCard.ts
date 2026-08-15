import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import type { PenaltyDecisionContext } from "../../career/services/playCareerMatch.js";
import {
  PENALTY_POWER_LABELS,
  type PenaltyChoice,
  type PenaltyCorner,
  type PenaltyPower,
} from "../../game/domain/penaltyDecision.js";

/** Prefix + corner + power is the whole customId — the collector is scoped to this exact message (see jogarCarreira.ts), same convention as MATCH_TACTIC_BUTTON_PREFIX. */
export const PENALTY_BUTTON_PREFIX = "penalty:";

export function penaltyButtonCustomId(choice: PenaltyChoice): string {
  return `${PENALTY_BUTTON_PREFIX}${choice.corner}:${choice.power}`;
}

export function parsePenaltyButtonCustomId(customId: string): PenaltyChoice {
  const rest = customId.slice(PENALTY_BUTTON_PREFIX.length);
  const [corner, power] = rest.split(":") as [PenaltyCorner, PenaltyPower];
  return { corner, power };
}

const CORNERS: PenaltyCorner[] = ["LEFT", "CENTER", "RIGHT"];
const POWERS: PenaltyPower[] = ["PLACED", "POWERFUL"];
const CORNER_ARROWS: Record<PenaltyCorner, string> = { LEFT: "⬅️", CENTER: "⬆️", RIGHT: "➡️" };

export function buildPenaltyDecisionCard(context: PenaltyDecisionContext): ContainerBuilder {
  const homeName = context.playerSide === "home" ? context.clubName : context.opponentName;
  const awayName = context.playerSide === "home" ? context.opponentName : context.clubName;

  const lines = [
    `**${homeName} ${context.homeScore} x ${context.awayScore} ${awayName}**`,
    `⚽ Pênalti aos ${context.minute}' pro seu time! **${context.takerName}** na bola.`,
    "Escolha o canto e a força da cobrança:",
    "_Sem resposta em 5 minutos, a cobrança sai no meio, colocada._",
  ];

  const container = new ContainerBuilder()
    .setAccentColor(0xe74c3c)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🥅 Cobrança de pênalti"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

  for (const power of POWERS) {
    const buttons = CORNERS.map((corner) =>
      new ButtonBuilder()
        .setCustomId(penaltyButtonCustomId({ corner, power }))
        .setLabel(`${CORNER_ARROWS[corner]} ${PENALTY_POWER_LABELS[power].replace(/^\S+\s/, "")}`)
        .setStyle(power === "POWERFUL" ? ButtonStyle.Danger : ButtonStyle.Primary),
    );
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
  }

  return container;
}
