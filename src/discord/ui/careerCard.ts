import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import { CAREER_STAGE_LABELS } from "../../career/domain/labels.js";
import type { ViewCareerOutput } from "../../career/services/viewCareer.js";

export function buildCareerCard(view: ViewCareerOutput): ContainerBuilder {
  const { player, career, club, seasonStat, hasActiveInjury } = view;

  const headerLines = [
    `**${player.name}** "${player.nickname}"`,
    `${club.name} • ${CAREER_STAGE_LABELS[career.stage]}`,
    `OVR ${player.overall} • Estamina ${player.stamina}/100`,
  ];
  if (hasActiveInjury) headerLines.push("🚑 Departamento médico — fora até se recuperar.");

  const statsLines = seasonStat
    ? [
        `**Temporada:** ${seasonStat.matches} partida(s)`,
        `${seasonStat.goals} gol(s) • ${seasonStat.assists} assistência(s)`,
        `Nota média: ${seasonStat.avgRating.toFixed(1)}`,
      ]
    : ["Ainda sem partidas nesta temporada. Use /jogar-carreira."];

  return new ContainerBuilder()
    .setAccentColor(hasActiveInjury ? 0xe74c3c : 0x2ecc71)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 📋 Carreira"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerLines.join("\n")))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(statsLines.join("\n")));
}
