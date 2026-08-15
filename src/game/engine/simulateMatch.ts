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
import { buildLog } from "./commentary.js";
import { initMatchState } from "./init.js";
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
 * A match paused at halftime — everything `simulateSecondHalf` needs to
 * finish the simulation. `state` is intentionally exposed (not just an
 * opaque handle): a caller running an *interactive* match can reach in
 * and mutate `state[side].squad.style` between the two calls — e.g. to
 * apply a player's halftime tactical choice — since resolvePhase reads
 * `squad.style` fresh every minute (see game/ai/decide.ts). Nothing about
 * `simulateFirstHalf` itself performs that mutation; it's purely a
 * resumable checkpoint.
 */
export interface FirstHalfHandle {
  state: MatchSimState;
  rng: Rng;
  events: SimMatchEvent[];
  seed: string;
}

function runFirstHalf(home: MatchSquad, away: MatchSquad, options: MatchOptions): FirstHalfHandle {
  validateSquad(home);
  validateSquad(away);

  const rng = createRng(options.seed);
  const state = initMatchState(home, away, rng);
  const events: SimMatchEvent[] = [
    { minute: 0, type: "KICKOFF", side: state.possession, playerId: null },
  ];

  for (let minute = 1; minute <= HALFTIME_MINUTE; minute++) {
    events.push(...resolvePhase(state, minute, rng));
  }

  events.push({ minute: HALFTIME_MINUTE, type: "HALFTIME", side: null, playerId: null });
  applyHalftimeRecovery(state.home);
  applyHalftimeRecovery(state.away);

  return { state, rng, events, seed: options.seed };
}

function runSecondHalf(firstHalf: FirstHalfHandle): MatchResult {
  const { state, rng, events, seed } = firstHalf;
  const home = state.home.squad;
  const away = state.away.squad;

  for (let minute = HALFTIME_MINUTE + 1; minute <= REGULATION_MINUTES; minute++) {
    events.push(...resolvePhase(state, minute, rng));
  }

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
): FirstHalfHandle {
  return runFirstHalf(home, away, options);
}

/** Resumes a `FirstHalfHandle` and finishes the match. See simulateFirstHalf's doc comment for the interactive-mutation contract. */
export function simulateSecondHalf(firstHalf: FirstHalfHandle): MatchResult {
  return runSecondHalf(firstHalf);
}

/**
 * Runs a full, deterministic match simulation in one call — the
 * non-interactive path used by every caller that doesn't need a
 * halftime pause (friendlies, duels, and career matches with no
 * `resolveHalftimeTactic` hook). Pure function: no I/O, no clock, no
 * randomness beyond what `options.seed` controls — the same inputs
 * always produce the exact same `MatchResult`. Literally just
 * simulateFirstHalf immediately followed by simulateSecondHalf with no
 * mutation in between, so this composition is byte-for-byte identical
 * to the pre-split implementation for the same seed.
 */
export function simulateMatch(
  home: MatchSquad,
  away: MatchSquad,
  options: MatchOptions,
): MatchResult {
  return runSecondHalf(runFirstHalf(home, away, options));
}
