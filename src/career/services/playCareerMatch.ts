import type { CareerStage } from "@prisma/client";
import type { CompetitionRepository } from "../../competitions/ports/competitionRepository.js";
import { ageFromBirthDate } from "../../economy/domain/marketValue.js";
import type { MarketRepository } from "../../economy/ports/marketRepository.js";
import type { WalletRepository } from "../../economy/ports/walletRepository.js";
import { ensureContract } from "../../economy/services/ensureContract.js";
import { grantMatchReward } from "../../economy/services/grantMatchReward.js";
import { buildSquadFromProfile, realPlayerMatchId } from "../../game/domain/buildSquadFromProfile.js";
import { generateSquad } from "../../game/domain/generateSquad.js";
import { createRng, weightedPick, type Rng } from "../../game/domain/rng.js";
import type { MatchResult, Side, TeamStyle } from "../../game/domain/types.js";
import { simulateMatch } from "../../game/engine/simulateMatch.js";
import type { MatchRepository } from "../../game/ports/matchRepository.js";
import type { RecordCategory } from "../../global/domain/records.js";
import type { RecordRepository } from "../../global/ports/recordRepository.js";
import { checkAndUpdateRecord } from "../../global/services/checkAndUpdateRecord.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { EventBus } from "../../shared/eventBus.js";
import { rollInjury } from "../domain/injury.js";
import { decideLineupStatus, type LineupStatus } from "../domain/lineup.js";
import { nextCareerStage } from "../domain/progression.js";
import type { CareerRepository } from "../ports/careerRepository.js";
import { ensureCareerStarted } from "./ensureCareerStarted.js";
import { resolveLeagueForSeason } from "./ensureLeagueTeams.js";

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
  marketRepository: MarketRepository;
  recordRepository: RecordRepository;
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
  salaryPaid: number;
  /** World records broken by this match (today only MOST_GOALS_SEASON can trigger here). */
  recordsBroken: RecordCategory[];
  /** True when this call also rolled the career into a fresh season (its previous season's fixtures were exhausted). */
  seasonRolledOver: boolean;
  /** The season this match was actually played in — after rollover, if any. */
  seasonNumber: number;
}

export async function playCareerMatch(deps: PlayCareerMatchDeps, input: PlayCareerMatchInput): Promise<PlayCareerMatchOutput> {
  const now = input.now ?? new Date();
  let { player, career, club, team, season } = await ensureCareerStarted(deps, input.discordId, now);

  // League membership (starter club + 6 rivals) is fixed independent of
  // which club the player currently represents — see ensureStarterTeam's
  // doc comment. Using `team`/`club` here instead would duplicate an
  // entry once the player has transferred into one of the rivals.
  let { tournamentId } = await resolveLeagueForSeason(deps.careerRepository, deps.competitionRepository, player, season);
  let fixture = await deps.competitionRepository.getNextFixtureForTeam(tournamentId, team.id);

  // This season's league calendar is exhausted — automatically roll the
  // career onto the next season (same shared rival pool, fresh
  // double-round-robin) rather than blocking the player forever. See ADR
  // 0001, adenda temporadas: rollover is per-career/per-league, not a
  // single synchronized global clock.
  const seasonRolledOver = fixture === null;
  if (fixture === null) {
    await deps.careerRepository.advanceCareerSeason(player.id, season.number + 1);
    ({ player, career, club, team, season } = await ensureCareerStarted(deps, input.discordId, now));
    ({ tournamentId } = await resolveLeagueForSeason(deps.careerRepository, deps.competitionRepository, player, season));
    fixture = await deps.competitionRepository.getNextFixtureForTeam(tournamentId, team.id);
    if (!fixture) {
      throw new Error("Internal error: freshly created season has no fixtures for this team");
    }
  }

  const isPlayerHome = fixture.homeTeamId === team.id;
  const opponentTeamId = isPlayerHome ? fixture.awayTeamId : fixture.homeTeamId;
  const opponentName = isPlayerHome ? fixture.awayTeamName : fixture.homeTeamName;
  // Resolved generically by team, not looked up in `rivals` — after a
  // transfer, an opponent can be the player's OLD (now purely synthetic)
  // club, which was never part of the fixed rival pool to begin with.
  const opponentClub = await deps.careerRepository.getClubByTeamId(opponentTeamId);
  if (!opponentClub) {
    throw new Error(`Internal error: fixture opponent team ${opponentTeamId} has no club`);
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
    avgOverall: opponentClub.reputation + 15,
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

  const recordsBroken: RecordCategory[] = [];
  if (persisted.seasonStat.goals > 0) {
    // Guards against the very first career match anyone in the world
    // ever plays trivially "setting a record" of 0 goals — checkAndUpdateRecord's
    // null-current case treats any value as a new record, which is
    // correct in general but not worth celebrating at zero.
    const goalsCheck = await checkAndUpdateRecord(
      { recordRepository: deps.recordRepository, events: deps.events },
      { category: "MOST_GOALS_SEASON", playerId: player.id, value: persisted.seasonStat.goals, now },
    );
    if (goalsCheck.isNewRecord) recordsBroken.push("MOST_GOALS_SEASON");
  }

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

  // Salary is contractual, not performance-based — paid every match
  // regardless of starting/bench/result, unlike the reward above.
  const contract = await ensureContract(
    { marketRepository: deps.marketRepository },
    {
      playerId: player.id,
      clubId: club.id,
      playerOverall: player.overall,
      playerAge: ageFromBirthDate(player.birthDate, now),
      now,
    },
  );
  const salaryResult = await deps.walletRepository.applyTransaction({
    userId: player.userId,
    currency: "COINS",
    type: "SOURCE",
    amount: BigInt(contract.salary),
    reason: "SALARY",
    idempotencyKey: `salary:${fixture.matchId}`,
  });
  const salaryPaid = salaryResult.alreadyApplied ? 0 : contract.salary;

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
    salaryPaid,
    recordsBroken,
    seasonRolledOver,
    seasonNumber: season.number,
  };
}
