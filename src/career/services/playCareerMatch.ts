import type { CareerStage } from "@prisma/client";
import type { CompetitionRepository } from "../../competitions/ports/competitionRepository.js";
import { grantMatchReward } from "../../economy/services/grantMatchReward.js";
import type { WalletRepository } from "../../economy/ports/walletRepository.js";
import { buildSquadFromProfile, realPlayerMatchId } from "../../game/domain/buildSquadFromProfile.js";
import { generateSquad } from "../../game/domain/generateSquad.js";
import { createRng, weightedPick, type Rng } from "../../game/domain/rng.js";
import type { MatchResult, Side, TeamStyle } from "../../game/domain/types.js";
import { simulateMatch } from "../../game/engine/simulateMatch.js";
import type { MatchRepository } from "../../game/ports/matchRepository.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { EventBus } from "../../shared/eventBus.js";
import { SeasonCompleteError } from "../domain/errors.js";
import { rollInjury } from "../domain/injury.js";
import { decideLineupStatus, type LineupStatus } from "../domain/lineup.js";
import { nextCareerStage } from "../domain/progression.js";
import type { CareerRepository } from "../ports/careerRepository.js";
import { ensureCareerStarted } from "./ensureCareerStarted.js";
import { buildLeagueTeams, ensureRivalTeams, leagueNameFor } from "./ensureLeagueTeams.js";

const ALL_STYLES: TeamStyle[] = ["DEFENSIVE", "AGGRESSIVE", "POSSESSION", "COUNTER_ATTACK", "DRIBBLING", "TACTICAL"];

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
  competitionRepository: CompetitionRepository;
  matchRepository: MatchRepository;
  walletRepository: WalletRepository;
  events: EventBus;
}

export interface PlayCareerMatchInput {
  discordId: string;
  now?: Date;
  /** Overrides the random match simulation seed — exists for deterministic tests, never set by the Discord command. */
  seed?: string;
}

export interface PlayCareerMatchOutput {
  result: MatchResult;
  lineupStatus: LineupStatus;
  clubName: string;
  opponentName: string;
  playerSide: Side;
  stageChanged: boolean;
  previousStage: CareerStage;
  newStage: CareerStage;
  injuryOccurred: boolean;
  coinsEarned: number;
}

export async function playCareerMatch(deps: PlayCareerMatchDeps, input: PlayCareerMatchInput): Promise<PlayCareerMatchOutput> {
  const now = input.now ?? new Date();
  const { player, career, club, team, season } = await ensureCareerStarted(deps, input.discordId);

  const rivals = await ensureRivalTeams(deps.careerRepository, season.id);
  const { tournamentId } = await deps.competitionRepository.getOrCreateSeasonLeague({
    seasonId: season.id,
    competitionName: leagueNameFor(player.nationality),
    teams: buildLeagueTeams(team.id, club.name, rivals),
  });

  const fixture = await deps.competitionRepository.getNextFixtureForTeam(tournamentId, team.id);
  if (!fixture) {
    throw new SeasonCompleteError();
  }

  const isPlayerHome = fixture.homeTeamId === team.id;
  const opponentTeamId = isPlayerHome ? fixture.awayTeamId : fixture.homeTeamId;
  const opponentName = isPlayerHome ? fixture.awayTeamName : fixture.homeTeamName;
  const opponentRival = rivals.find((rival) => rival.teamId === opponentTeamId);
  if (!opponentRival) {
    throw new Error(`Internal error: fixture opponent ${opponentTeamId} is not a known rival team`);
  }

  const hasActiveInjury = await deps.careerRepository.hasActiveInjury(player.id, now);
  const lineupStatus = decideLineupStatus({ stamina: player.stamina, hasActiveInjury });

  const seed = input.seed ?? fixture.matchId;
  const squadRng = createRng(`${seed}:squads`);
  const playerSquad = buildSquadFromProfile(player, {
    teamId: team.id,
    teamName: club.name,
    rng: squadRng,
    placement: lineupStatus === "STARTING" ? "STARTING" : "BENCH",
  });
  const opponentSquad = generateSquad({
    teamId: opponentTeamId,
    teamName: opponentName,
    style: randomStyle(squadRng),
    avgOverall: opponentRival.club.reputation + 15,
    rng: squadRng,
  });

  const home = isPlayerHome ? playerSquad : opponentSquad;
  const away = isPlayerHome ? opponentSquad : playerSquad;
  const playerSide: Side = isPlayerHome ? "home" : "away";

  deps.events.emit("MATCH_STARTED", { matchId: fixture.matchId });
  const result = simulateMatch(home, away, { seed });
  deps.events.emit("MATCH_FINISHED", { matchId: fixture.matchId, homeScore: result.homeScore, awayScore: result.awayScore });

  const matchPlayerInputId = realPlayerMatchId(player);
  const realStat = result.playerStats.find((stat) => stat.playerId === matchPlayerInputId);
  if (realStat) {
    // Player.stamina is an Int column — the engine's internal drain math is
    // fractional (see game/engine/stamina.ts), so this must be rounded
    // before it's ever written back.
    await deps.playerRepository.updateAttributes(player.userId, { stamina: Math.round(realStat.staminaRemaining) });
  }

  const persisted = await deps.matchRepository.persistMatchResult({
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    seasonId: season.id,
    scheduledAt: now,
    result,
    realPlayer: { playerId: player.id, matchPlayerInputId, side: playerSide },
    existingMatchId: fixture.matchId,
  });

  await deps.competitionRepository.recordFixtureResult(tournamentId, fixture.matchId, result.homeScore, result.awayScore);

  let coinsEarned = 0;
  if (realStat) {
    const playerScore = playerSide === "home" ? result.homeScore : result.awayScore;
    const opponentScore = playerSide === "home" ? result.awayScore : result.homeScore;
    const outcome = playerScore > opponentScore ? "WIN" : playerScore === opponentScore ? "DRAW" : "LOSS";

    const reward = await grantMatchReward(
      { walletRepository: deps.walletRepository },
      {
        userId: player.userId,
        matchId: fixture.matchId,
        outcome,
        lineupStatus,
        goals: realStat.goals,
        assists: realStat.assists,
        rating: realStat.rating,
      },
    );
    coinsEarned = reward.amount;
  }

  const injuredInMatch = result.events.some((event) => event.type === "INJURY" && event.playerId === matchPlayerInputId);
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

  const proposedStage = nextCareerStage(career.stage, persisted.seasonStat.matches, persisted.seasonStat.avgRating);
  const stageChanged = proposedStage !== career.stage;
  if (stageChanged) {
    await deps.careerRepository.updateCareerStage(player.id, proposedStage);
  }

  return {
    result,
    lineupStatus,
    clubName: club.name,
    opponentName,
    playerSide,
    stageChanged,
    previousStage: career.stage,
    newStage: proposedStage,
    injuryOccurred: injuredInMatch,
    coinsEarned,
  };
}
