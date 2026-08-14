import type { Position } from "@prisma/client";
import { randomInt, type Rng } from "./rng.js";
import type { MatchPlayerInput, MatchSquad, TeamStyle } from "./types.js";

/** GK, 4 defenders, 4 midfielders, 2 forwards — a plain 4-4-2 for a synthetic lineup. */
const STARTING_FORMATION: Position[] = [
  "GK",
  "LB",
  "CB",
  "CB",
  "RB",
  "LM",
  "CM",
  "CM",
  "RM",
  "ST",
  "ST",
];
/** Backup GK + one cover per line, so substitutions always have a same-ish-position option. */
const BENCH_FORMATION: Position[] = ["GK", "CB", "DM", "AM", "RW", "ST"];

const SPREAD = 12;

function randomAttribute(rng: Rng, avgOverall: number): number {
  return Math.min(99, Math.max(1, avgOverall + randomInt(rng, -SPREAD, SPREAD)));
}

function buildPlayer(
  rng: Rng,
  teamId: string,
  index: number,
  position: Position,
  avgOverall: number,
): MatchPlayerInput {
  const isGoalkeeper = position === "GK";
  const overall = randomAttribute(rng, avgOverall);

  return {
    id: `${teamId}-synthetic-${index}`,
    name: `Jogador ${index + 1}`,
    position,
    overall,
    pace: isGoalkeeper ? randomAttribute(rng, avgOverall - 10) : randomAttribute(rng, avgOverall),
    shooting: isGoalkeeper
      ? randomAttribute(rng, avgOverall - 20)
      : randomAttribute(rng, avgOverall),
    passing: randomAttribute(rng, avgOverall),
    dribbling: isGoalkeeper
      ? randomAttribute(rng, avgOverall - 20)
      : randomAttribute(rng, avgOverall),
    defending: isGoalkeeper
      ? randomAttribute(rng, avgOverall - 20)
      : randomAttribute(rng, avgOverall),
    physical: randomAttribute(rng, avgOverall),
    gkReflexes: isGoalkeeper ? randomAttribute(rng, avgOverall) : null,
    gkPositioning: isGoalkeeper ? randomAttribute(rng, avgOverall) : null,
    gkHandling: isGoalkeeper ? randomAttribute(rng, avgOverall) : null,
    gkAerial: isGoalkeeper ? randomAttribute(rng, avgOverall) : null,
    gkOneOnOne: isGoalkeeper ? randomAttribute(rng, avgOverall) : null,
    gkPenalties: isGoalkeeper ? randomAttribute(rng, avgOverall) : null,
  };
}

export interface GenerateSquadOptions {
  teamId: string;
  teamName: string;
  style: TeamStyle;
  avgOverall: number;
  rng: Rng;
}

/** Deterministic (given `rng`) synthetic squad — used for engine tests and for the opposing side of a `/simular-amistoso` friendly. */
export function generateSquad(options: GenerateSquadOptions): MatchSquad {
  const { teamId, teamName, style, avgOverall, rng } = options;
  const players = [...STARTING_FORMATION, ...BENCH_FORMATION].map((position, index) =>
    buildPlayer(rng, teamId, index, position, avgOverall),
  );

  return { teamId, teamName, style, players };
}
