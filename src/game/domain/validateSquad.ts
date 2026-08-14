import { AppError } from "../../shared/errors.js";
import type { MatchSquad } from "./types.js";

export class InvalidSquadError extends AppError {
  constructor(teamName: string, reason: string) {
    super("INVALID_SQUAD", `Escalação inválida para "${teamName}": ${reason}`);
    this.name = "InvalidSquadError";
  }
}

const STARTERS_COUNT = 11;

/** Called at the simulation boundary — a squad that fails this must never reach the AI/engine layer. */
export function validateSquad(squad: MatchSquad): void {
  if (squad.players.length < STARTERS_COUNT) {
    throw new InvalidSquadError(
      squad.teamName,
      `precisa de pelo menos ${STARTERS_COUNT} jogadores, tem ${squad.players.length}.`,
    );
  }

  const ids = new Set<string>();
  for (const player of squad.players) {
    if (ids.has(player.id)) {
      throw new InvalidSquadError(squad.teamName, `jogador duplicado: ${player.id}.`);
    }
    ids.add(player.id);
  }

  const starters = squad.players.slice(0, STARTERS_COUNT);
  const goalkeepers = starters.filter((player) => player.position === "GK");
  if (goalkeepers.length !== 1) {
    throw new InvalidSquadError(
      squad.teamName,
      `precisa de exatamente 1 goleiro entre os titulares, tem ${goalkeepers.length}.`,
    );
  }
}
