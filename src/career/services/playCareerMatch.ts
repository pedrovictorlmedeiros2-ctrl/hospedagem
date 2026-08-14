import { randomUUID } from "node:crypto";
import type { CareerStage } from "@prisma/client";
import {
  buildSquadFromProfile,
  realPlayerMatchId,
} from "../../game/domain/buildSquadFromProfile.js";
import { generateSquad } from "../../game/domain/generateSquad.js";
import { createRng, randomInt, weightedPick, type Rng } from "../../game/domain/rng.js";
import type { MatchResult, TeamStyle } from "../../game/domain/types.js";
import { simulateMatch } from "../../game/engine/simulateMatch.js";
import type { MatchRepository } from "../../game/ports/matchRepository.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { EventBus } from "../../shared/eventBus.js";
import { generateClubName, RIVAL_CLUB_KEYS } from "../domain/clubNaming.js";
import { rollInjury } from "../domain/injury.js";
import { decideLineupStatus, type LineupStatus } from "../domain/lineup.js";
import { nextCareerStage } from "../domain/progression.js";
import type { CareerRepository } from "../ports/careerRepository.js";
import { ensureCareerStarted } from "./ensureCareerStarted.js";

const ALL_STYLES: TeamStyle[] = [
  "DEFENSIVE",
  "AGGRESSIVE",
  "POSSESSION",
  "COUNTER_ATTACK",
  "DRIBBLING",
  "TACTICAL",
];
/** Fictional country codes for rival clubs — just flavor, not tied to any real confederation. */
const OPPONENT_COUNTRIES = ["AR", "PT", "ES", "FR", "DE", "IT", "UY", "NL"];
const OPPONENT_TIER = 3;
const OPPONENT_REPUTATION = 45;

function pickFrom<T>(rng: Rng, options: readonly T[]): T {
  const index = randomInt(rng, 0, options.length - 1);
  const value = options[index];
  if (value === undefined) {
    throw new Error("Internal error: pickFrom called with an empty options list");
  }
  return value;
}

function randomStyle(rng: Rng): TeamStyle {
  return weightedPick(
    rng,
    ALL_STYLES.map((style) => [style, 1] as const),
  );
}

export interface PlayCareerMatchDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
  matchRepository: MatchRepository;
  events: EventBus;
}

export interface PlayCareerMatchInput {
  discordId: string;
  now?: Date;
  /** Overrides the random match seed — exists for deterministic tests, never set by the Discord command. */
  seed?: string;
}

export interface PlayCareerMatchOutput {
  result: MatchResult;
  lineupStatus: LineupStatus;
  clubName: string;
  opponentName: string;
  stageChanged: boolean;
  previousStage: CareerStage;
  newStage: CareerStage;
  injuryOccurred: boolean;
}

export async function playCareerMatch(
  deps: PlayCareerMatchDeps,
  input: PlayCareerMatchInput,
): Promise<PlayCareerMatchOutput> {
  const now = input.now ?? new Date();
  const { player, career, club, team, season } = await ensureCareerStarted(deps, input.discordId);

  const seed = input.seed ?? randomUUID();

  const opponentKey = pickFrom(createRng(`${seed}:opponent-key`), RIVAL_CLUB_KEYS);
  const opponentClub = await deps.careerRepository.getOrCreateClub({
    externalKey: opponentKey,
    name: generateClubName(createRng(opponentKey)),
    country: pickFrom(createRng(`${opponentKey}:country`), OPPONENT_COUNTRIES),
    tier: OPPONENT_TIER,
    reputation: OPPONENT_REPUTATION,
  });
  const opponentTeam = await deps.careerRepository.getOrCreateTeam({
    clubId: opponentClub.id,
    seasonId: season.id,
    name: opponentClub.name,
  });

  const hasActiveInjury = await deps.careerRepository.hasActiveInjury(player.id, now);
  const lineupStatus = decideLineupStatus({ stamina: player.stamina, hasActiveInjury });

  const squadRng = createRng(`${seed}:squads`);
  const home = buildSquadFromProfile(player, {
    teamId: team.id,
    teamName: club.name,
    rng: squadRng,
    placement: lineupStatus === "STARTING" ? "STARTING" : "BENCH",
  });
  const away = generateSquad({
    teamId: opponentTeam.id,
    teamName: opponentClub.name,
    style: randomStyle(squadRng),
    avgOverall: opponentClub.reputation + 15,
    rng: squadRng,
  });

  deps.events.emit("MATCH_STARTED", { matchId: seed });
  const result = simulateMatch(home, away, { seed });
  deps.events.emit("MATCH_FINISHED", {
    matchId: seed,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
  });

  const matchPlayerInputId = realPlayerMatchId(player);
  const realStat = result.playerStats.find((stat) => stat.playerId === matchPlayerInputId);
  if (realStat) {
    // Player.stamina is an Int column — the engine's internal drain math is
    // fractional (see game/engine/stamina.ts), so this must be rounded
    // before it's ever written back.
    await deps.playerRepository.updateAttributes(player.userId, {
      stamina: Math.round(realStat.staminaRemaining),
    });
  }

  const persisted = await deps.matchRepository.persistMatchResult({
    homeTeamId: team.id,
    awayTeamId: opponentTeam.id,
    seasonId: season.id,
    scheduledAt: now,
    result,
    realPlayer: { playerId: player.id, matchPlayerInputId, side: "home" },
  });

  const injuredInMatch = result.events.some(
    (event) => event.type === "INJURY" && event.playerId === matchPlayerInputId,
  );
  if (injuredInMatch) {
    const rolled = rollInjury(createRng(`${seed}:injury`), now);
    await deps.careerRepository.recordInjury({
      playerId: player.id,
      severity: rolled.severity,
      diagnosis: rolled.diagnosis,
      occurredAt: now,
      expectedReturnAt: rolled.expectedReturnAt,
    });
  }

  const proposedStage = nextCareerStage(
    career.stage,
    persisted.seasonStat.matches,
    persisted.seasonStat.avgRating,
  );
  const stageChanged = proposedStage !== career.stage;
  if (stageChanged) {
    await deps.careerRepository.updateCareerStage(player.id, proposedStage);
  }

  return {
    result,
    lineupStatus,
    clubName: club.name,
    opponentName: opponentClub.name,
    stageChanged,
    previousStage: career.stage,
    newStage: proposedStage,
    injuryOccurred: injuredInMatch,
  };
}
