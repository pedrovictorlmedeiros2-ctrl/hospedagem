import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import type { SubstitutionDecisionContext } from "../../career/services/playCareerMatch.js";

/** Prefix + bench player id is the whole customId — the collector is scoped to this exact message (see jogarCarreira.ts), same convention as PENALTY_BUTTON_PREFIX. */
export const SUBSTITUTION_BUTTON_PREFIX = "sub:";

export function substitutionButtonCustomId(playerId: string): string {
  return `${SUBSTITUTION_BUTTON_PREFIX}${playerId}`;
}

export function parseSubstitutionButtonCustomId(customId: string): string {
  return customId.slice(SUBSTITUTION_BUTTON_PREFIX.length);
}

/** Discord caps 5 buttons per row and 5 rows per message — this keeps the card to a single screenful even for a deep bench. */
const MAX_BENCH_BUTTONS = 10;
const BUTTONS_PER_ROW = 5;

export function buildSubstitutionDecisionCard(context: SubstitutionDecisionContext): ContainerBuilder {
  const homeName = context.playerSide === "home" ? context.clubName : context.opponentName;
  const awayName = context.playerSide === "home" ? context.opponentName : context.clubName;

  const lines = [
    `**${homeName} ${context.homeScore} x ${context.awayScore} ${awayName}**`,
    `🔄 Aos ${context.minute}', **${context.outgoingName}** (${context.outgoingPosition}) está sem fôlego.`,
    "Escolha quem entra no lugar:",
    "_Sem resposta em 5 minutos, entra o reserva mais fresco da mesma posição._",
  ];

  const container = new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🔄 Substituição"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));

  const options = context.benchOptions.slice(0, MAX_BENCH_BUTTONS);
  for (let i = 0; i < options.length; i += BUTTONS_PER_ROW) {
    const rowOptions = options.slice(i, i + BUTTONS_PER_ROW);
    const buttons = rowOptions.map((player) =>
      new ButtonBuilder()
        .setCustomId(substitutionButtonCustomId(player.id))
        .setLabel(`${player.name} (${player.position})`)
        .setStyle(ButtonStyle.Primary),
    );
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
  }

  return container;
}
