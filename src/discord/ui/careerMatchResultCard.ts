import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import { CAREER_STAGE_LABELS } from "../../career/domain/labels.js";
import type { PlayCareerMatchOutput } from "../../career/services/playCareerMatch.js";
import type { MatchResult, SimMatchEventType } from "../../game/domain/types.js";

const HIGHLIGHT_TYPES: SimMatchEventType[] = [
  "GOAL",
  "PENALTY_SCORED",
  "PENALTY_MISSED",
  "RED_CARD",
  "INJURY",
];
const MAX_HIGHLIGHTS = 12;

function highlightLines(result: MatchResult): string[] {
  return result.events
    .map((event, index) => ({ event, line: result.log[index] }))
    .filter(({ event }) => HIGHLIGHT_TYPES.includes(event.type))
    .slice(0, MAX_HIGHLIGHTS)
    .map(({ line }) => line)
    .filter((line): line is string => Boolean(line));
}

export function buildCareerMatchResultCard(match: PlayCareerMatchOutput): ContainerBuilder {
  const { result } = match;

  // The player's club isn't always the home side anymore — a real league
  // calendar alternates home/away — so the scoreline must follow
  // `playerSide`, not assume the player is always listed first.
  const homeName = match.playerSide === "home" ? match.clubName : match.opponentName;
  const awayName = match.playerSide === "home" ? match.opponentName : match.clubName;
  const playerPossessionPct = match.playerSide === "home" ? result.homePossessionPct : 100 - result.homePossessionPct;

  const summaryLines = [
    `**${homeName} ${result.homeScore} x ${result.awayScore} ${awayName}**`,
    `Posse de bola — você: ${playerPossessionPct}% • ${match.opponentName}: ${100 - playerPossessionPct}%`,
    match.lineupStatus === "STARTING" ? "Você começou entre os titulares." : "Você começou no banco.",
    `🪙 +${match.coinsEarned} coins (recompensa) • +${match.salaryPaid} coins (salário)`,
  ];

  const container = new ContainerBuilder()
    .setAccentColor(match.recordsBroken.length > 0 ? 0xf1c40f : match.injuryOccurred ? 0xe74c3c : 0xf1c40f)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### ⚽ Partida da carreira"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(summaryLines.join("\n")));

  const highlights = highlightLines(result);
  if (highlights.length > 0) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(highlights.join("\n")));
  }

  const footerLines: string[] = [];
  if (match.stageChanged) {
    footerLines.push(
      `🎉 Promovido! Novo estágio de carreira: **${CAREER_STAGE_LABELS[match.newStage]}**.`,
    );
  }
  if (match.injuryOccurred) {
    footerLines.push(
      "🚑 Você se machucou nesta partida — confira /carreira para o prazo de recuperação.",
    );
  }
  if (match.recordsBroken.includes("MOST_GOALS_SEASON")) {
    footerLines.push("🏆 **NOVO RECORDE MUNDIAL DE GOLS NUMA TEMPORADA!** Confira /recordes.");
  }
  if (footerLines.length > 0) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(footerLines.join("\n")));
  }

  return container;
}
