import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import { CAREER_STAGE_LABELS } from "../../career/domain/labels.js";
import type { ViewCareerOutput } from "../../career/services/viewCareer.js";
import { menuButtonCustomId } from "../menuButtonId.js";
import { progressBar } from "./progressBar.js";

/** Double round-robin against the 6 shared rival clubs (see career/services/ensureLeagueTeams.ts) — fixed regardless of season number, so this is safe to hardcode purely for the progress bar's denominator. */
const MATCHES_PER_SEASON = 12;

export function buildCareerCard(view: ViewCareerOutput): ContainerBuilder {
  const { player, career, club, seasonStat, hasActiveInjury } = view;

  const headerLines = [
    `**${player.name}** "${player.nickname}"`,
    `${club.name} • ${CAREER_STAGE_LABELS[career.stage]} • Temporada ${career.currentSeasonNumber}`,
    `OVR ${player.overall}`,
    `Estamina ${progressBar(player.stamina, 100)} ${player.stamina}/100`,
  ];
  if (hasActiveInjury) headerLines.push("🚑 Departamento médico — fora até se recuperar.");

  const matchesPlayed = seasonStat?.matches ?? 0;
  const statsLines = seasonStat
    ? [
        `**Temporada:** ${progressBar(matchesPlayed, MATCHES_PER_SEASON)} ${matchesPlayed}/${MATCHES_PER_SEASON} partidas`,
        `⚽ ${seasonStat.goals} gol(s) • 🅰️ ${seasonStat.assists} assistência(s)`,
        `Nota média: ${seasonStat.avgRating.toFixed(1)}`,
      ]
    : ["Ainda sem partidas nesta temporada. Use /jogar-carreira."];

  const shortcuts = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(menuButtonCustomId("play")).setLabel("⚽ Jogar partida").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(menuButtonCustomId("wallet")).setLabel("🪙 Carteira").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(menuButtonCustomId("standings")).setLabel("🏆 Classificação").setStyle(ButtonStyle.Secondary),
  );

  return new ContainerBuilder()
    .setAccentColor(hasActiveInjury ? 0xe74c3c : 0x2ecc71)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 📋 Carreira"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerLines.join("\n")))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(statsLines.join("\n")))
    .addActionRowComponents(shortcuts);
}
