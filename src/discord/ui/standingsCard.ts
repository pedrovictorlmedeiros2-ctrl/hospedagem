import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import type { ViewStandingsOutput } from "../../career/services/viewStandings.js";

function padRight(text: string, length: number): string {
  return text.length >= length ? text.slice(0, length) : text + " ".repeat(length - text.length);
}

export function buildStandingsCard(view: ViewStandingsOutput): ContainerBuilder {
  const rows = view.standings.map((row, index) => {
    const position = `${index + 1}.`.padEnd(3);
    const marker = row.teamId === view.playerTeamId ? "➡️" : "  ";
    const name = padRight(row.teamName, 26);
    return `${marker}${position}${name} ${String(row.points).padStart(2)}pts (${row.played}J ${row.wins}V ${row.draws}E ${row.losses}D, SG ${row.goalDifference >= 0 ? "+" : ""}${row.goalDifference})`;
  });

  const table = rows.length > 0 ? rows.join("\n") : "Nenhuma partida disputada ainda nesta temporada.";

  return new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🏆 ${view.leagueName}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`\n${table}\n\`\`\``));
}
