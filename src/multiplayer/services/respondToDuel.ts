import type { AchievementKey } from "../../achievements/domain/catalog.js";
import type { AchievementRepository } from "../../achievements/ports/achievementRepository.js";
import { checkAndUnlockAchievements } from "../../achievements/services/checkAndUnlockAchievements.js";
import type { WalletRepository } from "../../economy/ports/walletRepository.js";
import { buildSquadFromProfile } from "../../game/domain/buildSquadFromProfile.js";
import { createRng } from "../../game/domain/rng.js";
import type { MatchResult } from "../../game/domain/types.js";
import { simulateMatch } from "../../game/engine/simulateMatch.js";
import type { RecordCategory } from "../../global/domain/records.js";
import type { RecordRepository } from "../../global/ports/recordRepository.js";
import type { RivalryRepository } from "../../global/ports/rivalryRepository.js";
import { checkAndUpdateRecord } from "../../global/services/checkAndUpdateRecord.js";
import type { UserRepository } from "../../identity/ports/userRepository.js";
import { ProfileNotFoundError } from "../../player/domain/errors.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import { ValidationError } from "../../shared/errors.js";
import type { EventBus } from "../../shared/eventBus.js";
import { calculateDuelReward } from "../domain/duelReward.js";
import { calculateEloUpdate, type DuelOutcome } from "../domain/elo.js";
import type { DuelRepository } from "../ports/duelRepository.js";

export interface RespondToDuelDeps {
  userRepository: UserRepository;
  playerRepository: PlayerRepository;
  duelRepository: DuelRepository;
  walletRepository: WalletRepository;
  recordRepository: RecordRepository;
  rivalryRepository: RivalryRepository;
  achievementRepository: AchievementRepository;
  events: EventBus;
}

export interface RespondToDuelInput {
  /** The responder — the person this duel was sent TO. */
  discordId: string;
  challengerDiscordId: string;
  accept: boolean;
  now?: Date;
  /** Overrides the match simulation seed — exists for deterministic tests, never set by the Discord command. */
  seed?: string;
}

export interface DuelDeclinedOutput {
  accepted: false;
}

export interface DuelResolvedOutput {
  accepted: true;
  result: MatchResult;
  outcome: DuelOutcome;
  /** Discord id of the winner, null if a draw. */
  winnerDiscordId: string | null;
  challengerRatingDelta: number;
  opponentRatingDelta: number;
  challengerReward: number;
  opponentReward: number;
  /** World records broken by either player as a result of this duel (today only HIGHEST_GLOBAL_RATING can trigger here). */
  recordsBroken: RecordCategory[];
  rivalryChallengerWins: number;
  rivalryOpponentWins: number;
  challengerAchievementsUnlocked: AchievementKey[];
  opponentAchievementsUnlocked: AchievementKey[];
}

export type RespondToDuelOutput = DuelDeclinedOutput | DuelResolvedOutput;

export async function respondToDuel(deps: RespondToDuelDeps, input: RespondToDuelInput): Promise<RespondToDuelOutput> {
  const now = input.now ?? new Date();
  const responder = await deps.userRepository.ensureUserForDiscordId(input.discordId);
  const challenger = await deps.userRepository.ensureUserForDiscordId(input.challengerDiscordId);

  const duel = await deps.duelRepository.findPendingDuelFromChallenger(challenger.id, responder.id);
  if (!duel) {
    throw new ValidationError("Você não tem nenhum duelo pendente desse desafiante. Confira /duelos.");
  }

  if (!input.accept) {
    await deps.duelRepository.declineDuel(duel.id);
    return { accepted: false };
  }

  const challengerPlayer = await deps.playerRepository.findByUserId(challenger.id);
  const opponentPlayer = await deps.playerRepository.findByUserId(responder.id);
  if (!challengerPlayer || !opponentPlayer) {
    throw new ProfileNotFoundError();
  }

  const seed = input.seed ?? `duel:${duel.id}`;
  const squadRng = createRng(`${seed}:squads`);
  // Both squads are "one real player + synthetic teammates" — the exact
  // same builder career/services/playCareerMatch.ts uses for the career
  // player, just called twice instead of once. No game-engine changes
  // needed for player-vs-player duels.
  const challengerSquad = buildSquadFromProfile(challengerPlayer, {
    teamId: `duel-challenger-${duel.id}`,
    teamName: challengerPlayer.nickname,
    rng: squadRng,
    placement: "STARTING",
  });
  const opponentSquad = buildSquadFromProfile(opponentPlayer, {
    teamId: `duel-opponent-${duel.id}`,
    teamName: opponentPlayer.nickname,
    rng: squadRng,
    placement: "STARTING",
  });

  deps.events.emit("MATCH_STARTED", { matchId: duel.id });
  const result = simulateMatch(challengerSquad, opponentSquad, { seed });
  deps.events.emit("MATCH_FINISHED", { matchId: duel.id, homeScore: result.homeScore, awayScore: result.awayScore });

  const outcome: DuelOutcome =
    result.homeScore > result.awayScore ? "CHALLENGER_WIN" : result.homeScore < result.awayScore ? "OPPONENT_WIN" : "DRAW";
  const winnerId = outcome === "CHALLENGER_WIN" ? challenger.id : outcome === "OPPONENT_WIN" ? responder.id : null;

  // Claimed FIRST, guarded by status (PENDING -> FINISHED): a retry after
  // this line finds the duel no longer PENDING and is cleanly rejected,
  // instead of re-simulating and re-applying rating/rewards a second
  // time. A crash between this line and the writes below leaves an
  // incomplete-but-not-corrupt state — same accepted risk category as
  // Injury/Match, FixtureResult/MatchResult and Contract/Transfer
  // elsewhere in this codebase (see docs/RISK_REGISTER.md).
  await deps.duelRepository.resolveDuel({ duelId: duel.id, winnerId, resolvedAt: now });

  const eloUpdate = calculateEloUpdate({
    challengerRating: challengerPlayer.globalRating,
    opponentRating: opponentPlayer.globalRating,
    outcome,
  });
  await deps.playerRepository.updateAttributes(challenger.id, { globalRating: eloUpdate.newChallengerRating });
  await deps.playerRepository.updateAttributes(responder.id, { globalRating: eloUpdate.newOpponentRating });

  const recordsBroken: RecordCategory[] = [];
  const recordBreakerPlayerIds = new Set<string>();
  for (const [playerId, newRating] of [
    [challengerPlayer.id, eloUpdate.newChallengerRating],
    [opponentPlayer.id, eloUpdate.newOpponentRating],
  ] as const) {
    const check = await checkAndUpdateRecord(
      { recordRepository: deps.recordRepository, events: deps.events },
      { category: "HIGHEST_GLOBAL_RATING", playerId, value: newRating, now },
    );
    if (check.isNewRecord) {
      recordsBroken.push("HIGHEST_GLOBAL_RATING");
      recordBreakerPlayerIds.add(playerId);
    }
  }

  const winnerPlayerId =
    outcome === "CHALLENGER_WIN" ? challengerPlayer.id : outcome === "OPPONENT_WIN" ? opponentPlayer.id : null;
  const rivalry = await deps.rivalryRepository.recordRivalryResult(
    challengerPlayer.id,
    opponentPlayer.id,
    winnerPlayerId,
    now,
  );
  const rivalryChallengerWins = rivalry.playerAId === challengerPlayer.id ? rivalry.playerAWins : rivalry.playerBWins;
  const rivalryOpponentWins = rivalry.playerAId === challengerPlayer.id ? rivalry.playerBWins : rivalry.playerAWins;

  const challengerResult = outcome === "CHALLENGER_WIN" ? "WIN" : outcome === "DRAW" ? "DRAW" : "LOSS";
  const opponentResult = outcome === "OPPONENT_WIN" ? "WIN" : outcome === "DRAW" ? "DRAW" : "LOSS";
  const challengerReward = calculateDuelReward(challengerResult);
  const opponentReward = calculateDuelReward(opponentResult);

  await deps.walletRepository.applyTransaction({
    userId: challenger.id,
    currency: "COINS",
    type: "SOURCE",
    amount: BigInt(challengerReward),
    reason: "DUEL_REWARD",
    idempotencyKey: `duel-reward:${duel.id}:challenger`,
  });
  await deps.walletRepository.applyTransaction({
    userId: responder.id,
    currency: "COINS",
    type: "SOURCE",
    amount: BigInt(opponentReward),
    reason: "DUEL_REWARD",
    idempotencyKey: `duel-reward:${duel.id}:opponent`,
  });

  const challengerAchievementCandidates: AchievementKey[] = [];
  if (outcome === "CHALLENGER_WIN") challengerAchievementCandidates.push("DUEL_WINNER");
  if (recordBreakerPlayerIds.has(challengerPlayer.id)) challengerAchievementCandidates.push("WORLD_RECORD");
  const challengerAchievementsUnlocked = await checkAndUnlockAchievements(
    { achievementRepository: deps.achievementRepository },
    challenger.id,
    challengerAchievementCandidates,
    now,
  );

  const opponentAchievementCandidates: AchievementKey[] = [];
  if (outcome === "OPPONENT_WIN") opponentAchievementCandidates.push("DUEL_WINNER");
  if (recordBreakerPlayerIds.has(opponentPlayer.id)) opponentAchievementCandidates.push("WORLD_RECORD");
  const opponentAchievementsUnlocked = await checkAndUnlockAchievements(
    { achievementRepository: deps.achievementRepository },
    responder.id,
    opponentAchievementCandidates,
    now,
  );

  return {
    accepted: true,
    result,
    outcome,
    winnerDiscordId:
      outcome === "CHALLENGER_WIN" ? input.challengerDiscordId : outcome === "OPPONENT_WIN" ? input.discordId : null,
    challengerRatingDelta: eloUpdate.challengerDelta,
    opponentRatingDelta: eloUpdate.opponentDelta,
    challengerReward,
    opponentReward,
    recordsBroken,
    rivalryChallengerWins,
    rivalryOpponentWins,
    challengerAchievementsUnlocked,
    opponentAchievementsUnlocked,
  };
}
