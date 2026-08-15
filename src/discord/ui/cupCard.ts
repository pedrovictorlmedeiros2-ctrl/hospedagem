import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import { STAGE_TYPE_LABELS } from "../../competitions/domain/labels.js";
import type { CupStatusRecord } from "../../competitions/ports/cupRepository.js";
import type { PlayCupMatchOutput } from "../../career/services/playCupMatch.js";
import { progressBar } from "./progressBar.js";

function bracketLines(status: CupStatusRecord): string[] {
  const lines: string[] = [];
  let currentStage: string | null = null;
  for (const match of status.stages) {
    if (match.stage !== currentStage) {
      currentStage = match.stage;
      lines.push(`**${STAGE_TYPE_LABELS[match.stage]}**`);
    }
    const scoreline =
      match.homeScore !== null && match.awayScore !== null
        ? `${match.homeTeamName} ${match.homeScore} x ${match.awayScore} ${match.awayTeamName}`
        : `${match.homeTeamName} x ${match.awayTeamName} (a definir)`;
    const winnerNote = match.winnerTeamName ? ` — avança ${match.winnerTeamName}` : "";
    lines.push(`${scoreline}${winnerNote}`);
  }
  return lines;
}

export function buildCupCard(match: PlayCupMatchOutput): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(match.championTeamName ? 0xf1c40f : 0x9b59b6)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🏆 ${match.cupName}`));

  if (match.played && match.result) {
    const { result } = match;
    const homeName = match.playerSide === "home" ? match.clubName : match.opponentName;
    const awayName = match.playerSide === "home" ? match.opponentName : match.clubName;
    const playerPossessionPct = match.playerSide === "home" ? result.homePossessionPct : 100 - result.homePossessionPct;

    const summaryLines = [
      `**${homeName} ${result.homeScore} x ${result.awayScore} ${awayName}**`,
      `Posse — você ${progressBar(playerPossessionPct, 100, 12)} ${playerPossessionPct}% x ${100 - playerPossessionPct}% ${match.opponentName}`,
      match.outcome === "WIN" ? "🎉 Vitória — você avança de fase!" : "😔 Eliminado — sua campanha na copa termina aqui.",
      `🪙 +${match.coinsEarned} coins`,
    ];
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(summaryLines.join("\n")));
  } else if (!match.played) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          match.championTeamName
            ? `A copa já foi decidida — confira o campeão abaixo.`
            : "Nada pra jogar na copa agora — ou seu time já caiu, ou o outro lado da chave ainda não terminou a rodada.",
        ),
      );
  }

  const bracket = bracketLines(match.status);
  if (bracket.length > 0) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(bracket.join("\n")));
  }

  if (match.championTeamName) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🏆 **Campeão: ${match.championTeamName}**`));
  }

  return container;
}
