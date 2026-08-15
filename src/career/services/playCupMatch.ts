import { resolveCupWinner } from "../../competitions/domain/resolveCupWinner.js";
import type { CupRepository, CupStatusRecord } from "../../competitions/ports/cupRepository.js";
import type { WalletRepository } from "../../economy/ports/walletRepository.js";
import { grantCupReward } from "../../economy/services/grantCupReward.js";
import { buildSquadFromProfile, realPlayerMatchId } from "../../game/domain/buildSquadFromProfile.js";
import { generateSquad } from "../../game/domain/generateSquad.js";
import { createRng, weightedPick, type Rng } from "../../game/domain/rng.js";
import type { MatchResult, Side, TeamStyle } from "../../game/domain/types.js";
import { simulateMatch } from "../../game/engine/simulateMatch.js";
import type { MatchRepository } from "../../game/ports/matchRepository.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { EventBus } from "../../shared/eventBus.js";
import { decideLineupStatus, type LineupStatus } from "../domain/lineup.js";
import type { CareerRepository } from "../ports/careerRepository.js";
import { ensureCareerStarted } from "./ensureCareerStarted.js";
import { cupNameFor, resolveCupForSeason } from "./ensureLeagueTeams.js";

const ALL_STYLES: TeamStyle[] = ["DEFENSIVE", "AGGRESSIVE", "POSSESSION", "COUNTER_ATTACK", "DRIBBLING", "TACTICAL"];

function randomStyle(rng: Rng): TeamStyle {
  return weightedPick(
    rng,
    ALL_STYLES.map((style) => [style, 1] as const),
  );
}

export interface PlayCupMatchDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  careerRepository: CareerRepository;
  cupRepository: CupRepository;
  matchRepository: MatchRepository;
  walletRepository: WalletRepository;
  events: EventBus;
}

export interface PlayCupMatchInput {
  discordId: string;
  now?: Date;
  /** Overrides the random match simulation seed — exists for deterministic tests, never set by the Discord command. */
  seed?: string;
}

export interface PlayCupMatchOutput {
  played: boolean;
  /** Present whenever played is false — nothing to play right now (eliminated, waiting on the other half of the bracket, or the cup is already decided). */
  status: CupStatusRecord;
  cupName: string;
  result?: MatchResult;
  lineupStatus?: LineupStatus;
  clubName?: string;
  opponentName?: string;
  playerSide?: Side;
  coinsEarned?: number;
  outcome?: "WIN" | "LOSS" | undefined;
  championTeamName?: string | null;
}

/**
 * Plays the cup's next pending fixture for the caller's team, if any —
 * unlike playCareerMatch.ts (the league), there's no interactive
 * halftime/70' tactic decision here and no career-stage/injury/salary
 * side effects: the cup is deliberately a lighter, self-contained mode
 * with its own reward (see economy/domain/cupReward.ts). A single full
 * 90-minute simulation, same as the pre-interactive-decisions league flow.
 */
export async function playCupMatch(deps: PlayCupMatchDeps, input: PlayCupMatchInput): Promise<PlayCupMatchOutput> {
  const now = input.now ?? new Date();
  const { player, club, team, season } = await ensureCareerStarted(deps, input.discordId, now);

  const { tournamentId } = await resolveCupForSeason(deps.careerRepository, deps.cupRepository, player, season);
  const cupName = cupNameFor(player.nationality);
  const fixture = await deps.cupRepository.getNextFixtureForTeam(tournamentId, team.id);

  if (!fixture) {
    const status = await deps.cupRepository.getStatus(tournamentId);
    return { played: false, status, cupName, championTeamName: status.championTeamName };
  }

  const isPlayerHome = fixture.homeTeamId === team.id;
  const opponentTeamId = isPlayerHome ? fixture.awayTeamId : fixture.homeTeamId;
  const opponentName = isPlayerHome ? fixture.awayTeamName : fixture.homeTeamName;
  const opponentClub = await deps.careerRepository.getClubByTeamId(opponentTeamId);
  if (!opponentClub) {
    throw new Error(`Internal error: cup fixture opponent team ${opponentTeamId} has no club`);
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

  await deps.matchRepository.persistMatchResult({
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    seasonId: season.id,
    scheduledAt: now,
    result,
    realPlayer: { playerId: player.id, matchPlayerInputId, side: playerSide },
    existingMatchId: fixture.matchId,
  });

  await deps.cupRepository.recordFixtureResult(tournamentId, fixture.matchId, result.homeScore, result.awayScore);

  let coinsEarned = 0;
  let outcome: "WIN" | "LOSS" | undefined;
  if (realStat) {
    // A cup match can never end in a draw (see resolveCupWinner) — a
    // level scoreline is broken by a deterministic shootout, so the
    // player's actual outcome is read from the same winner-resolution
    // function the bracket itself uses, not just the raw scoreline.
    const winnerTeamId = resolveCupWinner({
      matchId: fixture.matchId,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
    });
    outcome = winnerTeamId === team.id ? "WIN" : "LOSS";

    const reward = await grantCupReward(
      { walletRepository: deps.walletRepository },
      {
        userId: player.userId,
        matchId: fixture.matchId,
        stage: fixture.stage,
        outcome,
        lineupStatus,
      },
    );
    coinsEarned = reward.amount;
  }

  const status = await deps.cupRepository.getStatus(tournamentId);

  return {
    played: true,
    status,
    cupName,
    result,
    lineupStatus,
    clubName: club.name,
    opponentName,
    playerSide,
    coinsEarned,
    outcome,
    championTeamName: status.championTeamName,
  };
}
