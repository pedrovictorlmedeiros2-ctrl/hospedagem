import type { PenaltyChoice } from "../domain/penaltyDecision.js";
import { createRng, type Rng } from "../domain/rng.js";
import type { MatchSimState, TeamRuntimeState } from "../domain/state.js";
import { validateSquad } from "../domain/validateSquad.js";
import type {
  MatchOptions,
  MatchPlayerStatLine,
  MatchResult,
  MatchSquad,
  SimMatchEvent,
} from "../domain/types.js";
import { MIDFIELD } from "../domain/types.js";
import { buildLog } from "./commentary.js";
import { initMatchState } from "./init.js";
import { resolvePenalty } from "./resolveAction.js";
import { resolvePhase } from "./resolvePhase.js";
import { applyHalftimeRecovery } from "./stamina.js";

const REGULATION_MINUTES = 90;
const HALFTIME_MINUTE = 45;
const MAX_STOPPAGE_MINUTES = 6;

function countStoppageWorthyEvents(events: SimMatchEvent[], sinceMinute: number): number {
  return events.filter(
    (event) =>
      event.minute > sinceMinute &&
      (event.type === "INJURY" ||
        event.type === "SUBSTITUTION" ||
        event.type === "YELLOW_CARD" ||
        event.type === "RED_CARD"),
  ).length;
}

function collectPlayerStats(team: TeamRuntimeState, side: "home" | "away"): MatchPlayerStatLine[] {
  return team.squad.players.map((player) => {
    const stats = team.stats.get(player.id);
    const minutesPlayed = stats?.minutesPlayed ?? 0;
    const goals = stats?.goals ?? 0;
    const assists = stats?.assists ?? 0;
    const rating = computeRating({
      minutesPlayed,
      goals,
      assists,
      tackles: stats?.tackles ?? 0,
      saves: stats?.saves ?? 0,
    });

    return {
      playerId: player.id,
      side,
      minutesPlayed,
      goals,
      assists,
      shots: stats?.shots ?? 0,
      passesCompleted: stats?.passesCompleted ?? 0,
      tackles: stats?.tackles ?? 0,
      interceptions: stats?.interceptions ?? 0,
      saves: stats?.saves ?? 0,
      goalsConceded: stats?.goalsConceded ?? 0,
      rating,
      staminaRemaining: stats?.stamina ?? 100,
    };
  });
}

function computeRating(input: {
  minutesPlayed: number;
  goals: number;
  assists: number;
  tackles: number;
  saves: number;
}): number {
  if (input.minutesPlayed === 0) return 0;
  const base = 6.0;
  const bonus = input.goals * 0.9 + input.assists * 0.5 + input.tackles * 0.05 + input.saves * 0.08;
  return Math.round(Math.min(10, base + bonus) * 10) / 10;
}

/**
 * A match paused mid-simulation, resumable from `nextMinute` onward.
 * `state` is intentionally exposed (not just an opaque handle): a caller
 * running an *interactive* match can reach in and mutate
 * `state[side].squad.style` while paused — e.g. to apply a player's
 * tactical choice — since resolvePhase reads `squad.style` fresh every
 * minute (see game/ai/decide.ts). Nothing about producing a handle
 * performs that mutation; it's purely a resumable checkpoint. A match can
 * be paused any number of times (see simulateUntilMinute) before finally
 * being finished with simulateSecondHalf.
 */
export interface MatchHandle {
  state: MatchSimState;
  rng: Rng;
  events: SimMatchEvent[];
  seed: string;
  /** The next regulation minute to simulate when this handle is resumed. */
  nextMinute: number;
  /** Carried from the originating MatchOptions across every pause/resume — see MatchOptions.pauseOnPenalty. */
  pauseOnPenalty: boolean;
}

/**
 * The shared per-minute loop for every MatchHandle-returning phase —
 * stops EARLY, before `toMinute`, the instant `resolvePhase` defers a
 * penalty (`state.pendingPenalty` gets set — see PendingPenalty). Returns
 * the minute the loop should resume from next time, whether that's
 * because it ran clean to `toMinute` or paused partway through.
 */
function runMinutesUntil(
  state: MatchSimState,
  rng: Rng,
  events: SimMatchEvent[],
  fromMinute: number,
  toMinute: number,
  pauseOnPenalty: boolean,
): number {
  for (let minute = fromMinute; minute <= toMinute; minute++) {
    events.push(...resolvePhase(state, minute, rng, pauseOnPenalty));
    if (state.pendingPenalty) return minute + 1;
  }
  return toMinute + 1;
}

function runFirstHalf(home: MatchSquad, away: MatchSquad, options: MatchOptions): MatchHandle {
  validateSquad(home);
  validateSquad(away);

  const rng = createRng(options.seed);
  const state = initMatchState(home, away, rng);
  const events: SimMatchEvent[] = [
    { minute: 0, type: "KICKOFF", side: state.possession, playerId: null },
  ];
  const pauseOnPenalty = options.pauseOnPenalty ?? false;

  const nextMinute = runMinutesUntil(state, rng, events, 1, HALFTIME_MINUTE, pauseOnPenalty);
  if (state.pendingPenalty) {
    return { state, rng, events, seed: options.seed, nextMinute, pauseOnPenalty };
  }

  events.push({ minute: HALFTIME_MINUTE, type: "HALFTIME", side: null, playerId: null });
  applyHalftimeRecovery(state.home);
  applyHalftimeRecovery(state.away);

  return { state, rng, events, seed: options.seed, nextMinute, pauseOnPenalty };
}

function runUntilMinute(handle: MatchHandle, uptoMinute: number): MatchHandle {
  const { state, rng, events, seed, pauseOnPenalty } = handle;
  const nextMinute = runMinutesUntil(state, rng, events, handle.nextMinute, uptoMinute, pauseOnPenalty);
  return { state, rng, events, seed, nextMinute, pauseOnPenalty };
}

/**
 * Resumes a `MatchHandle` that paused mid-first-half for a pending
 * penalty (see resumePendingPenalty), continuing toward minute 45 and
 * finishing halftime bookkeeping (HALFTIME event + stamina recovery) once
 * truly reached. Safe to call when there's nothing to resume (already
 * past halftime) — returns the handle unchanged. A second (or third...)
 * penalty before 45 just means calling this again after resolving it.
 */
export function resumeFirstHalf(handle: MatchHandle): MatchHandle {
  if (handle.nextMinute > HALFTIME_MINUTE) return handle;

  const resumed = runUntilMinute(handle, HALFTIME_MINUTE);
  if (resumed.state.pendingPenalty) return resumed;

  resumed.events.push({ minute: HALFTIME_MINUTE, type: "HALFTIME", side: null, playerId: null });
  applyHalftimeRecovery(resumed.state.home);
  applyHalftimeRecovery(resumed.state.away);
  return resumed;
}

/**
 * Resolves a handle's pending penalty (a no-op if none is pending) and
 * clears it — `choice` is the real player's interactive decision, omitted
 * for every non-interactive case (an opponent's penalty, or any caller
 * not tracking a specific side at all), which resolves exactly like the
 * original inline path (see resolvePenalty's doc comment). The handle
 * itself doesn't advance past the penalty's own minute — call
 * `resumeFirstHalf` or `simulateUntilMinute` afterward to keep going.
 */
export function resumePendingPenalty(handle: MatchHandle, choice?: PenaltyChoice): MatchHandle {
  const { state, rng, events } = handle;
  const pending = state.pendingPenalty;
  if (!pending) return handle;

  const { minute, attackingSide, taker, gk } = pending;
  const defendingSide: "home" | "away" = attackingSide === "home" ? "away" : "home";
  const attackingTeam = state[attackingSide];
  const defendingTeam = state[defendingSide];

  const result = resolvePenalty(taker, gk, rng, choice);
  if (result === "SCORED") {
    if (attackingSide === "home") state.homeScore += 1;
    else state.awayScore += 1;
    const stats = attackingTeam.stats.get(taker.id);
    if (stats) stats.goals += 1;
    events.push({ minute, type: "PENALTY_SCORED", side: attackingSide, playerId: taker.id });
  } else {
    events.push({ minute, type: "PENALTY_MISSED", side: attackingSide, playerId: taker.id });
    if (gk) {
      const gkStats = defendingTeam.stats.get(gk.id);
      if (gkStats) gkStats.saves += 1;
    }
  }

  state.zone = MIDFIELD;
  state.possession = defendingSide;
  delete state.pendingPenalty;

  return handle;
}

function runSecondHalf(handle: MatchHandle): MatchResult {
  const { state, rng, events, seed } = handle;
  const home = state.home.squad;
  const away = state.away.squad;

  // Never pauses, regardless of handle.pauseOnPenalty: a penalty in the
  // final stretch (71'+) always resolves inline, same as before this
  // feature existed. Making the last ~20 minutes (plus stoppage, whose
  // very length depends on the full event list) resumable too would mean
  // MatchResult itself — not just MatchHandle — needs a "paused" variant,
  // a much bigger change for a rare, late-match edge case. See ADR 0001,
  // adenda "Pênalti interativo".
  runMinutesUntil(state, rng, events, handle.nextMinute, REGULATION_MINUTES, false);

  const stoppage = Math.min(
    MAX_STOPPAGE_MINUTES,
    1 + Math.floor(countStoppageWorthyEvents(events, HALFTIME_MINUTE) / 2),
  );
  for (let extra = 1; extra <= stoppage; extra++) {
    events.push(...resolvePhase(state, REGULATION_MINUTES + extra, rng));
  }

  events.push({
    minute: REGULATION_MINUTES + stoppage,
    type: "FULLTIME",
    side: null,
    playerId: null,
  });

  const totalPossessionMinutes = state.possessionMinutes.home + state.possessionMinutes.away;
  const homePossessionPct =
    totalPossessionMinutes === 0
      ? 50
      : Math.round((state.possessionMinutes.home / totalPossessionMinutes) * 100);

  return {
    seed,
    homeTeamId: home.teamId,
    awayTeamId: away.teamId,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    homePossessionPct,
    events,
    playerStats: [
      ...collectPlayerStats(state.home, "home"),
      ...collectPlayerStats(state.away, "away"),
    ],
    log: buildLog(events, home, away),
  };
}

/**
 * Runs the match up to and including halftime recovery, then returns a
 * resumable handle instead of the final result — the entry point for an
 * *interactive* match that pauses for a real decision (see
 * career/services/playCareerMatch.ts's `resolveHalftimeTactic`). Still
 * fully deterministic: the same seed/squads always produce the same
 * first-half events, independent of whatever happens after the pause.
 */
export function simulateFirstHalf(
  home: MatchSquad,
  away: MatchSquad,
  options: MatchOptions,
): MatchHandle {
  return runFirstHalf(home, away, options);
}

/**
 * Resumes a `MatchHandle` and runs regulation minutes up to (and
 * including) `uptoMinute`, WITHOUT finishing the match — a second (or
 * third, etc.) pause point after halftime, e.g. career/services/
 * playCareerMatch.ts's `resolveLateGameTactic` at minute 70. `uptoMinute`
 * must be between the handle's current position and 90 (stoppage time
 * is only ever attached by simulateSecondHalf, at the very end).
 */
export function simulateUntilMinute(handle: MatchHandle, uptoMinute: number): MatchHandle {
  return runUntilMinute(handle, uptoMinute);
}

/** Resumes a `MatchHandle` (from any pause point) and finishes the match. See simulateFirstHalf's doc comment for the interactive-mutation contract. */
export function simulateSecondHalf(handle: MatchHandle): MatchResult {
  return runSecondHalf(handle);
}

/**
 * Runs a full, deterministic match simulation in one call — the
 * non-interactive path used by every caller that doesn't need any pause
 * (friendlies, duels, and career matches with no interactive tactic
 * hooks). Pure function: no I/O, no clock, no randomness beyond what
 * `options.seed` controls — the same inputs always produce the exact
 * same `MatchResult`. Literally just simulateFirstHalf immediately
 * followed by simulateSecondHalf with no mutation in between, so this
 * composition is byte-for-byte identical to the pre-split implementation
 * for the same seed.
 */
export function simulateMatch(
  home: MatchSquad,
  away: MatchSquad,
  options: MatchOptions,
): MatchResult {
  return runSecondHalf(runFirstHalf(home, away, options));
}
