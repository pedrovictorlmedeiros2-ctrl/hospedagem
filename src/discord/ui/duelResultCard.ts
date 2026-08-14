import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import type { DuelResolvedOutput } from "../../multiplayer/services/respondToDuel.js";
import type { MatchResult, SimMatchEventType } from "../../game/domain/types.js";

const HIGHLIGHT_TYPES: SimMatchEventType[] = ["GOAL", "PENALTY_SCORED", "PENALTY_MISSED", "RED_CARD"];
const MAX_HIGHLIGHTS = 10;

function highlightLines(result: MatchResult): string[] {
  return result.events
    .map((event, index) => ({ event, line: result.log[index] }))
    .filter(({ event }) => HIGHLIGHT_TYPES.includes(event.type))
    .slice(0, MAX_HIGHLIGHTS)
    .map(({ line }) => line)
    .filter((line): line is string => Boolean(line));
}

function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

export function buildDuelResultCard(
  output: DuelResolvedOutput,
  challengerName: string,
  opponentName: string,
  winnerName: string | null,
): ContainerBuilder {
  const { result } = output;

  const summaryLines = [
    `**${challengerName} ${result.homeScore} x ${result.awayScore} ${opponentName}**`,
    winnerName ? `Vencedor: **${winnerName}**` : "Empate!",
    `${challengerName}: ${formatDelta(output.challengerRatingDelta)} rating • +${output.challengerReward} coins`,
    `${opponentName}: ${formatDelta(output.opponentRatingDelta)} rating • +${output.opponentReward} coins`,
    `Histórico: ${challengerName} ${output.rivalryChallengerWins} x ${output.rivalryOpponentWins} ${opponentName}`,
  ];

  const container = new ContainerBuilder()
    .setAccentColor(output.recordsBroken.length > 0 ? 0xf1c40f : 0x9b59b6)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("### ⚔️ Resultado do duelo"))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(summaryLines.join("\n")));

  const highlights = highlightLines(result);
  if (highlights.length > 0) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(highlights.join("\n")));
  }

  if (output.recordsBroken.length > 0) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("🏆 **NOVO RECORDE MUNDIAL DE RATING!** Confira /recordes."),
      );
  }

  return container;
}
