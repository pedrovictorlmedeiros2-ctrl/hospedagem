import type { MatchSquad, SimMatchEvent, Side } from "../domain/types.js";

function playerName(
  home: MatchSquad,
  away: MatchSquad,
  side: Side | null,
  playerId: string | null,
): string {
  if (!playerId) return "um jogador";
  const squad = side === "away" ? away : home;
  return squad.players.find((player) => player.id === playerId)?.name ?? "um jogador";
}

function teamName(home: MatchSquad, away: MatchSquad, side: Side | null): string {
  if (side === "away") return away.teamName;
  if (side === "home") return home.teamName;
  return "";
}

/** Turns the raw event log into human-readable PT-BR commentary lines — also the shape of "structured facts" a future narrative layer (Groq, Fase 10) would summarize, never invent. */
export function buildLog(events: SimMatchEvent[], home: MatchSquad, away: MatchSquad): string[] {
  return events.map((event) => {
    const player = () => playerName(home, away, event.side, event.playerId);
    const team = () => teamName(home, away, event.side);

    switch (event.type) {
      case "KICKOFF":
        return `${event.minute}' — Bola rolando! ${team()} inicia a partida.`;
      case "GOAL":
        return `${event.minute}' — ⚽ GOL! ${player()} (${team()}) balança as redes.`;
      case "OWN_GOAL":
        return `${event.minute}' — ⚽ Gol contra de ${player()} (${team()}).`;
      case "YELLOW_CARD":
        return `${event.minute}' — 🟨 Cartão amarelo para ${player()} (${team()}).`;
      case "RED_CARD":
        return `${event.minute}' — 🟥 Cartão vermelho! ${player()} (${team()}) está fora de campo.`;
      case "SUBSTITUTION": {
        const outId =
          typeof event.metadata?.["outPlayerId"] === "string"
            ? event.metadata["outPlayerId"]
            : null;
        const outName = playerName(home, away, event.side, outId);
        return `${event.minute}' — 🔄 Substituição em ${team()}: entra ${player()}, sai ${outName}.`;
      }
      case "INJURY":
        return `${event.minute}' — 🚑 ${player()} (${team()}) sente uma lesão.`;
      case "PENALTY_SCORED":
        return `${event.minute}' — ⚽ Pênalti convertido por ${player()} (${team()})!`;
      case "PENALTY_MISSED":
        return `${event.minute}' — ❌ ${player()} (${team()}) desperdiça a cobrança de pênalti.`;
      case "CORNER":
        return `${event.minute}' — 🚩 Escanteio para ${team()}.`;
      case "OFFSIDE":
        return `${event.minute}' — 🚩 Impedimento marcado contra ${team()}.`;
      case "HALFTIME":
        return `${event.minute}' — ⏸️ Fim do primeiro tempo.`;
      case "FULLTIME":
        return `${event.minute}' — 🏁 Fim de jogo.`;
      default:
        return `${event.minute}' — ${event.type}`;
    }
  });
}
