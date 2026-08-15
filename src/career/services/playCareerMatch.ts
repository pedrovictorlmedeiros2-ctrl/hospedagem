import type { CareerStage } from "@prisma/client";
import type { AchievementKey } from "../../achievements/domain/catalog.js";
import type { AchievementRepository } from "../../achievements/ports/achievementRepository.js";
import { checkAndUnlockAchievements } from "../../achievements/services/checkAndUnlockAchievements.js";
import type { CompetitionRepository } from "../../competitions/ports/competitionRepository.js";
import { ageFromBirthDate } from "../../economy/domain/marketValue.js";
import type { MarketRepository } from "../../economy/ports/marketRepository.js";
import type { WalletRepository } from "../../economy/ports/walletRepository.js";
import { ensureContract } from "../../economy/services/ensureContract.js";
import { grantMatchReward } from "../../economy/services/grantMatchReward.js";
import { buildSquadFromProfile, realPlayerMatchId } from "../../game/domain/buildSquadFromProfile.js";
import { generateSquad } from "../../game/domain/generateSquad.js";
import type { PenaltyChoice } from "../../game/domain/penaltyDecision.js";
import { createRng, weightedPick, type Rng } from "../../game/domain/rng.js";
import { styleForMatchTactic, type MatchTacticChoice } from "../../game/domain/tactics.js";
import type { MatchResult, Side, TeamStyle } from "../../game/domain/types.js";
import {
  resumeFirstHalf,
  resumePendingPenalty,
  simulateFirstHalf,
  simulateSecondHalf,
  simulateUntilMinute,
  type MatchHandle,
} from "../../game/engine/simulateMatch.js";
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

/** The regulation minute the second (late-game) tactical decision fires at — a natural "final stretch" moment, far enough from both halftime and fulltime to feel like its own beat. */
const LATE_GAME_DECISION_MINUTE = 70;

export interface MatchTacticContext {
  homeScore: number;
  awayScore: number;
  /** Which side the real player is on — the tactical choice only ever changes the PLAYER's team style, never the opponent's. */
  playerSide: Side;
  clubName: string;
  opponentName: string;
  /** The regulation minute this decision is being made at (45 for halftime, 70 for the late-game check-in) — lets a single UI builder phrase the prompt/countdown correctly for either pause point. */
  minute: number;
}

/** Resolves a tactical decision for an interactive match — see discord/commands/jogarCarreira.ts for the Discord-button adapter (sends a tactic card, awaits a click, falls back to BALANCED on timeout). Shared shape for both PlayCareerMatchDeps hooks below; each is called at a different pause point. */
export type ResolveMatchTactic = (context: MatchTacticContext) => Promise<MatchTacticChoice>;

export interface PenaltyDecisionContext {
  minute: number;
  takerName: string;
  playerSide: Side;
  clubName: string;
  opponentName: string;
  homeScore: number;
  awayScore: number;
}

/** Resolves the real player's own penalty (corner + power) — never called for the opponent's penalty, which always resolves automatically. See PlayCareerMatchDeps.resolvePenaltyDecision. */
export type ResolvePenaltyDecision = (context: PenaltyDecisionContext) => Promise<PenaltyChoice>;

export interface PlayCareerMatchDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
  competitionRepository: CompetitionRepository;
  matchRepository: MatchRepository;
  walletRepository: WalletRepository;
  marketRepository: MarketRepository;
  recordRepository: RecordRepository;
  achievementRepository: AchievementRepository;
  events: EventBus;
  /**
   * Optional hook for an interactive halftime tactical decision. Called
   * once, right after the first half, with the score at the break — must
   * resolve to a choice, which is then applied to the player's squad
   * style. Omitted (the default, and every existing caller/test)
   * preserves the exact old single-pass simulation: the player's squad
   * stays at its default TACTICAL style the whole match, byte-identical
   * to before this hook existed.
   */
  resolveHalftimeTactic?: ResolveMatchTactic;
  /**
   * Optional hook for a SECOND tactical decision, at
   * LATE_GAME_DECISION_MINUTE (70') — only fires when provided; omitting
   * it plays straight from halftime (or kickoff) to fulltime in one
   * simulation call, exactly as before this hook existed. Independent of
   * `resolveHalftimeTactic`: either can be provided without the other.
   */
  resolveLateGameTactic?: ResolveMatchTactic;
  /**
   * Optional hook for an interactive penalty kick — corner + power —
   * fired only when the pending penalty is the PLAYER's own (an
   * opponent's penalty always auto-resolves, exactly like today).
   * Omitted (the default) means every penalty resolves automatically,
   * byte-identical to before this hook existed. Only takes effect for
   * minutes 1-70 — see game/engine/simulateMatch.ts's runSecondHalf doc
   * comment for why the final stretch (71'+) never pauses.
   */
  resolvePenaltyDecision?: ResolvePenaltyDecision;
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
  /** Achievements unlocked for the first time by this specific match. */
  achievementsUnlocked: AchievementKey[];
}

/**
 * Drains every pending penalty on `handle` before returning — asking
 * `deps.resolvePenaltyDecision` only when it's the PLAYER's own side
 * (an opponent's penalty always auto-resolves with no choice, same as
 * before this hook existed). `resume` continues toward whichever
 * boundary the caller was originally heading to (resumeFirstHalf for
 * the 1-45 stretch, `simulateUntilMinute(h, 70)` for 46-70) — a second
 * penalty before that boundary just means looping again.
 */
async function drainPendingPenalties(
  handle: MatchHandle,
  resume: (handle: MatchHandle) => MatchHandle,
  deps: Pick<PlayCareerMatchDeps, "resolvePenaltyDecision">,
  context: { playerSide: Side; clubName: string; opponentName: string },
): Promise<MatchHandle> {
  while (handle.state.pendingPenalty) {
    const pending = handle.state.pendingPenalty;
    let choice: PenaltyChoice | undefined;
    if (pending.attackingSide === context.playerSide && deps.resolvePenaltyDecision) {
      choice = await deps.resolvePenaltyDecision({
        minute: pending.minute,
        takerName: pending.taker.name,
        playerSide: context.playerSide,
        clubName: context.clubName,
        opponentName: context.opponentName,
        homeScore: handle.state.homeScore,
        awayScore: handle.state.awayScore,
      });
    }
    handle = resumePendingPenalty(handle, choice);
    handle = resume(handle);
  }
  return handle;
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
  const wantsPenaltyPause = !!deps.resolvePenaltyDecision;
  const penaltyContext = { playerSide, clubName: club.name, opponentName };

  let handle = simulateFirstHalf(home, away, { seed, pauseOnPenalty: wantsPenaltyPause });
  handle = await drainPendingPenalties(handle, resumeFirstHalf, deps, penaltyContext);
  if (deps.resolveHalftimeTactic) {
    const choice = await deps.resolveHalftimeTactic({
      homeScore: handle.state.homeScore,
      awayScore: handle.state.awayScore,
      playerSide,
      clubName: club.name,
      opponentName,
      minute: 45,
    });
    handle.state[playerSide].squad.style = styleForMatchTactic(choice);
  }
  // Also runs the 46-70 stretch through the pausable path (not just when
  // resolveLateGameTactic is set) whenever the player has a penalty hook
  // at all — otherwise a penalty in this window would only ever hit
  // simulateSecondHalf's inline, non-interactive path.
  if (deps.resolveLateGameTactic || wantsPenaltyPause) {
    handle = simulateUntilMinute(handle, LATE_GAME_DECISION_MINUTE);
    handle = await drainPendingPenalties(handle, (h) => simulateUntilMinute(h, LATE_GAME_DECISION_MINUTE), deps, penaltyContext);
    if (deps.resolveLateGameTactic) {
      const choice = await deps.resolveLateGameTactic({
        homeScore: handle.state.homeScore,
        awayScore: handle.state.awayScore,
        playerSide,
        clubName: club.name,
        opponentName,
        minute: LATE_GAME_DECISION_MINUTE,
      });
      handle.state[playerSide].squad.style = styleForMatchTactic(choice);
    }
  }
  const result = simulateSecondHalf(handle);
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
  let matchOutcome: "WIN" | "DRAW" | "LOSS" | null = null;
  if (realStat) {
    const playerScore = playerSide === "home" ? result.homeScore : result.awayScore;
    const opponentScore = playerSide === "home" ? result.awayScore : result.homeScore;
    matchOutcome = playerScore > opponentScore ? "WIN" : playerScore === opponentScore ? "DRAW" : "LOSS";

    const reward = await grantMatchReward(
      { walletRepository: deps.walletRepository },
      {
        userId: player.userId,
        matchId: fixture.matchId,
        outcome: matchOutcome,
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

  const achievementCandidates: AchievementKey[] = ["FIRST_MATCH"];
  if (matchOutcome === "WIN") achievementCandidates.push("FIRST_WIN");
  if (realStat && realStat.goals > 0) achievementCandidates.push("FIRST_GOAL");
  if (recordsBroken.length > 0) achievementCandidates.push("WORLD_RECORD");
  const achievementsUnlocked = await checkAndUnlockAchievements(
    { achievementRepository: deps.achievementRepository },
    player.userId,
    achievementCandidates,
    now,
  );

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
    achievementsUnlocked,
  };
}
