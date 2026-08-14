import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import { FOOT_LABELS, PLAYSTYLE_LABELS, POSITION_LABELS } from "../../player/domain/labels.js";
import type { PlayerRecord } from "../../player/ports/playerRepository.js";

/** ISO 3166-1 alpha-2 → flag emoji via the standard regional-indicator codepoint offset (0x1F1E6 - 'A'.charCodeAt(0)). */
function countryCodeToFlagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

export interface ProfileCardOptions {
  title: string;
  accentColor: number;
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

  return new ContainerBuilder()
    .setAccentColor(options.accentColor)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${options.title}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n")));
}
