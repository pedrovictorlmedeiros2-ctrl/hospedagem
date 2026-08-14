import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import type { MatchResult, MatchSquad, SimMatchEventType } from "../../game/domain/types.js";

const HIGHLIGHT_TYPES: SimMatchEventType[] = [
  "GOAL",
  "PENALTY_SCORED",
  "PENALTY_MISSED",
  "RED_CARD",
];
const MAX_HIGHLIGHTS = 12;

export function buildMatchResultCard(
  result: MatchResult,
  home: MatchSquad,
  away: MatchSquad,
): ContainerBuilder {
  const highlights = result.events
    .map((event, index) => ({ event, line: result.log[index] }))
    .filter(({ event }) => HIGHLIGHT_TYPES.includes(event.type))
    .slice(0, MAX_HIGHLIGHTS)
    .map(({ line }) => line)
    .filter((line): line is string => Boolean(line));

  const summary = [
    `**${home.teamName} ${result.homeScore} x ${result.awayScore} ${away.teamName}**`,
    `Posse de bola: ${result.homePossessionPct}% x ${100 - result.homePossessionPct}%`,
  ].join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(0xf1c40f)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### ⚽ Resultado da partida"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(summary));

  if (highlights.length > 0) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(highlights.join("\n")));
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "_Amistoso de teste do motor de partida — times gerados sinteticamente, sem valer para carreira ou ranking ainda._",
      ),
    );

  return container;
}
