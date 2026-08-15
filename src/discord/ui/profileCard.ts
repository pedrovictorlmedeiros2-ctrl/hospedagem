import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import {
  CORE_ATTRIBUTE_SHORT_LABELS,
  FOOT_LABELS,
  GOALKEEPER_ATTRIBUTE_SHORT_LABELS,
  PLAYSTYLE_LABELS,
  POSITION_LABELS,
} from "../../player/domain/labels.js";
import type { PlayerRecord } from "../../player/ports/playerRepository.js";
import { countryCodeToFlagEmoji } from "../../shared/flagEmoji.js";
import { progressBar } from "./progressBar.js";

export interface ProfileCardOptions {
  title: string;
  accentColor: number;
}

/**
 * FIFA-card-style attribute grid: one short label + bar per stat, laid
 * out two columns wide in a fixed-width code block (```) so the bars
 * actually line up — Discord's normal text has no monospace guarantee,
 * but content inside a code fence does.
 */
function attributeGrid(player: PlayerRecord): string {
  const entries: [string, number][] =
    player.position === "GK"
      ? (Object.entries(GOALKEEPER_ATTRIBUTE_SHORT_LABELS) as [keyof typeof GOALKEEPER_ATTRIBUTE_SHORT_LABELS, string][]).map(
          ([field, short]) => [short, player[field] ?? 0],
        )
      : (Object.entries(CORE_ATTRIBUTE_SHORT_LABELS) as [keyof typeof CORE_ATTRIBUTE_SHORT_LABELS, string][]).map(
          ([field, short]) => [short, player[field]],
        );

  const rows = entries.map(([label, value]) => `${label} ${progressBar(value, 99, 8)} ${String(value).padStart(2)}`);
  return `\`\`\`\n${rows.join("\n")}\n\`\`\``;
}

export function buildProfileCard(
  player: PlayerRecord,
  options: ProfileCardOptions,
): ContainerBuilder {
  const flag = countryCodeToFlagEmoji(player.nationality);
  const numberLabel = player.shirtNumber ? `#${player.shirtNumber}` : "sem número";

  const lines = [
    `**${player.name}** "${player.nickname}" ${flag}`,
    `${POSITION_LABELS[player.position]} • ${numberLabel} • Pé ${FOOT_LABELS[player.preferredFoot].toLowerCase()}`,
    `Estilo: ${PLAYSTYLE_LABELS[player.playStyle]} • Altura: ${player.heightCm}cm`,
    `**OVR ${player.overall}** • Forma ${player.form} • Rating global ${player.globalRating.toFixed(1)}`,
  ];

  if (player.bio) lines.push(`_"${player.bio}"_`);

  const container = new ContainerBuilder()
    .setAccentColor(options.accentColor)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${options.title}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(attributeGrid(player)));

  return container;
}
