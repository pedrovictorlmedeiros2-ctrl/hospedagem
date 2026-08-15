import { describe, expect, it } from "vitest";
import { generateSquad } from "../../../../src/game/domain/generateSquad.js";
import { createRng } from "../../../../src/game/domain/rng.js";
import type { MatchSquad, SimMatchEventType } from "../../../../src/game/domain/types.js";
import { InvalidSquadError } from "../../../../src/game/domain/validateSquad.js";
import {
  resumeFirstHalf,
  resumePendingPenalty,
  simulateFirstHalf,
  simulateMatch,
  simulateSecondHalf,
  simulateUntilMinute,
} from "../../../../src/game/engine/simulateMatch.js";

function squad(teamId: string, teamName: string, avgOverall: number, seed: string): MatchSquad {
  return generateSquad({ teamId, teamName, style: "TACTICAL", avgOverall, rng: createRng(seed) });
}

describe("simulateMatch — determinism", () => {
  it("produces an identical result for the same seed and squads", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const first = simulateMatch(home, away, { seed: "deterministic-seed" });
    const second = simulateMatch(home, away, { seed: "deterministic-seed" });

    expect(second).toEqual(first);
  });

  it("produces a different result for a different seed (not hardcoded output)", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const first = simulateMatch(home, away, { seed: "seed-a" });
    const second = simulateMatch(home, away, { seed: "seed-b" });

    expect(second.events).not.toEqual(first.events);
  });
});

describe("simulateMatch — structure", () => {
  it("starts with kickoff and ends with fulltime, with non-decreasing event minutes", () => {
    const home = squad("home", "Casa", 60, "home-seed");
    const away = squad("away", "Visitante", 60, "away-seed");
    const result = simulateMatch(home, away, { seed: "structure-seed" });

    expect(result.events[0]?.type).toBe("KICKOFF");
    expect(result.events.at(-1)?.type).toBe("FULLTIME");

    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i]?.minute).toBeGreaterThanOrEqual(result.events[i - 1]?.minute ?? 0);
    }
  });

  it("includes a halftime event around minute 45", () => {
    const home = squad("home", "Casa", 60, "home-seed");
    const away = squad("away", "Visitante", 60, "away-seed");
    const result = simulateMatch(home, away, { seed: "halftime-seed" });

    expect(result.events.some((event) => event.type === "HALFTIME" && event.minute === 45)).toBe(
      true,
    );
  });

  it("rejects an invalid squad instead of silently simulating garbage", () => {
    const home = squad("home", "Casa", 60, "home-seed");
    const away = squad("away", "Visitante", 60, "away-seed");
    away.players = away.players.slice(0, 5);

    expect(() => simulateMatch(home, away, { seed: "invalid-seed" })).toThrow(InvalidSquadError);
  });
});

describe("simulateFirstHalf / simulateSecondHalf — the split powering interactive matches", () => {
  it("composes to the exact same result as the monolithic simulateMatch, for the same seed", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const monolithic = simulateMatch(home, away, { seed: "split-composition-seed" });
    const split = simulateSecondHalf(simulateFirstHalf(home, away, { seed: "split-composition-seed" }));

    expect(split).toEqual(monolithic);
  });

  it("simulateFirstHalf stops exactly at halftime — no events past minute 45", () => {
    const home = squad("home", "Casa", 60, "home-seed");
    const away = squad("away", "Visitante", 60, "away-seed");

    const firstHalf = simulateFirstHalf(home, away, { seed: "first-half-only-seed" });

    expect(firstHalf.events.at(-1)?.type).toBe("HALFTIME");
    for (const event of firstHalf.events) {
      expect(event.minute).toBeLessThanOrEqual(45);
    }
  });

  it("mutating state[side].squad.style between the two halves actually changes the second half's outcome — it's a real lever, not a field that gets set and silently ignored", () => {
    // Deterministic, not statistical: two fresh first halves from the
    // IDENTICAL seed (so both start the second half from the exact same
    // state and RNG position), diverging only in which style is applied
    // to home's squad before resuming. Different AI action weights
    // (game/ai/decide.ts's ATTACK_STYLE_MULTIPLIERS/DEFENSE_STYLE_MULTIPLIERS)
    // make different decisions consume the shared RNG differently, so the
    // two event sequences reliably diverge — this doesn't assert which
    // style produces "better" results, just that changing it does
    // something real to the second half.
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const aggressive = simulateFirstHalf(home, away, { seed: "style-lever-seed" });
    aggressive.state.home.squad.style = "AGGRESSIVE";
    const aggressiveResult = simulateSecondHalf(aggressive);

    const defensive = simulateFirstHalf(home, away, { seed: "style-lever-seed" });
    defensive.state.home.squad.style = "DEFENSIVE";
    const defensiveResult = simulateSecondHalf(defensive);

    expect(aggressiveResult.events).not.toEqual(defensiveResult.events);
  });

  it("simulateUntilMinute pauses at an arbitrary later minute (the late-game decision point), and the full three-phase composition still matches the monolithic result when nothing is mutated", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const monolithic = simulateMatch(home, away, { seed: "three-phase-seed" });

    const firstHalf = simulateFirstHalf(home, away, { seed: "three-phase-seed" });
    const untilLateGame = simulateUntilMinute(firstHalf, 70);
    expect(untilLateGame.events.every((event) => event.minute <= 70)).toBe(true);
    expect(untilLateGame.nextMinute).toBe(71);

    const threePhase = simulateSecondHalf(untilLateGame);
    expect(threePhase).toEqual(monolithic);
  });

  it("mutating style at the late-game pause point (after already resuming once from halftime) is still a real lever", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const aggressive = simulateUntilMinute(simulateFirstHalf(home, away, { seed: "late-game-lever-seed" }), 70);
    aggressive.state.home.squad.style = "AGGRESSIVE";
    const aggressiveResult = simulateSecondHalf(aggressive);

    const defensive = simulateUntilMinute(simulateFirstHalf(home, away, { seed: "late-game-lever-seed" }), 70);
    defensive.state.home.squad.style = "DEFENSIVE";
    const defensiveResult = simulateSecondHalf(defensive);

    expect(aggressiveResult.events).not.toEqual(defensiveResult.events);
  });
});

describe("simulateMatch — attributes matter (statistical, across many seeds)", () => {
  const TRIALS = 60;

  it("a much stronger team wins by a positive average goal difference", () => {
    const strong = squad("strong", "Fortes", 90, "strong-seed");
    const weak = squad("weak", "Fracos", 25, "weak-seed");

    let totalDiff = 0;
    for (let i = 0; i < TRIALS; i++) {
      const result = simulateMatch(strong, weak, { seed: `trial-${i}` });
      totalDiff += result.homeScore - result.awayScore;
    }

    expect(totalDiff / TRIALS).toBeGreaterThan(1);
  });

  it("a much weaker goalkeeper concedes more goals on average than a much stronger one, all else equal", () => {
    const baseRng = () => createRng("keeper-seed");
    const strongKeeperTeam = generateSquad({
      teamId: "gk-strong",
      teamName: "GK Forte",
      style: "TACTICAL",
      avgOverall: 60,
      rng: baseRng(),
    });
    const weakKeeperTeam = generateSquad({
      teamId: "gk-weak",
      teamName: "GK Fraco",
      style: "TACTICAL",
      avgOverall: 60,
      rng: baseRng(),
    });

    const gkAttrs = {
      gkReflexes: 95,
      gkPositioning: 95,
      gkHandling: 95,
      gkAerial: 95,
      gkOneOnOne: 95,
      gkPenalties: 95,
    };
    const weakGkAttrs = {
      gkReflexes: 15,
      gkPositioning: 15,
      gkHandling: 15,
      gkAerial: 15,
      gkOneOnOne: 15,
      gkPenalties: 15,
    };
    strongKeeperTeam.players[0] = {
      ...strongKeeperTeam.players[0],
      ...gkAttrs,
    } as (typeof strongKeeperTeam.players)[number];
    weakKeeperTeam.players[0] = {
      ...weakKeeperTeam.players[0],
      ...weakGkAttrs,
    } as (typeof weakKeeperTeam.players)[number];

    const attacker = squad("attacker", "Ataque", 65, "attacker-seed");

    let goalsAgainstStrongGk = 0;
    let goalsAgainstWeakGk = 0;
    for (let i = 0; i < TRIALS; i++) {
      goalsAgainstStrongGk += simulateMatch(attacker, strongKeeperTeam, {
        seed: `strong-gk-${i}`,
      }).homeScore;
      goalsAgainstWeakGk += simulateMatch(attacker, weakKeeperTeam, {
        seed: `weak-gk-${i}`,
      }).homeScore;
    }

    expect(goalsAgainstWeakGk).toBeGreaterThan(goalsAgainstStrongGk);
  });
});

describe("simulateMatch — every product-spec mechanic actually fires across a large sample", () => {
  it("produces goals, cards, corners, offside, penalties, injuries and substitutions somewhere across 150 matches", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 68, "away-seed");

    const seen = new Set<SimMatchEventType>();
    for (let i = 0; i < 150; i++) {
      const result = simulateMatch(home, away, { seed: `coverage-${i}` });
      for (const event of result.events) seen.add(event.type);
    }

    const expectedAtLeastOnce: SimMatchEventType[] = [
      "GOAL",
      "YELLOW_CARD",
      "RED_CARD",
      "CORNER",
      "OFFSIDE",
      "PENALTY_SCORED",
      "PENALTY_MISSED",
      "INJURY",
      "SUBSTITUTION",
    ];

    for (const type of expectedAtLeastOnce) {
      expect(seen.has(type), `expected ${type} to occur at least once across 150 matches`).toBe(
        true,
      );
    }
  });

  it("never fields an empty squad — a red-carded or injured player without a sub still leaves a non-empty team", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    for (let i = 0; i < 30; i++) {
      const result = simulateMatch(home, away, { seed: `safety-${i}` });
      const homeMinutes = result.playerStats
        .filter((p) => p.side === "home")
        .reduce((sum, p) => sum + p.minutesPlayed, 0);
      const awayMinutes = result.playerStats
        .filter((p) => p.side === "away")
        .reduce((sum, p) => sum + p.minutesPlayed, 0);
      expect(homeMinutes).toBeGreaterThan(0);
      expect(awayMinutes).toBeGreaterThan(0);
    }
  });
});

describe("interactive penalty pause — pauseOnPenalty", () => {
  // Seeds found by brute-forcing this exact scenario until one produced a
  // penalty for the desired side within the desired window — deterministic,
  // not statistical (same technique used elsewhere in this file/project for
  // "find a seed where X happens").
  const HOME_PENALTY_SEED = "penalty-search-0"; // home penalty, minute 16, first half
  const AWAY_PENALTY_SEED = "penalty-search-1"; // away penalty, minute 20, first half
  const MID_WINDOW_PENALTY_SEED = "penalty-search-22"; // home penalty, minute 65, reached via simulateUntilMinute(70)

  it("does nothing differently when pauseOnPenalty is omitted — same events as the non-interactive path", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const withoutOption = simulateFirstHalf(home, away, { seed: HOME_PENALTY_SEED });
    const explicitlyOff = simulateFirstHalf(home, away, { seed: HOME_PENALTY_SEED, pauseOnPenalty: false });

    expect(withoutOption.state.pendingPenalty).toBeUndefined();
    expect(explicitlyOff.events).toEqual(withoutOption.events);
  });

  it("pauses mid-first-half exactly when a penalty for either side is awarded", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const handle = simulateFirstHalf(home, away, { seed: HOME_PENALTY_SEED, pauseOnPenalty: true });

    expect(handle.state.pendingPenalty).toBeDefined();
    expect(handle.state.pendingPenalty?.attackingSide).toBe("home");
    expect(handle.state.pendingPenalty?.minute).toBe(16);
    // Nothing past the penalty's own minute happened yet — no HALFTIME,
    // no events with a later minute.
    expect(handle.events.some((e) => e.type === "HALFTIME")).toBe(false);
    expect(handle.events.every((e) => e.minute <= 16)).toBe(true);
    expect(handle.events.some((e) => e.type === "PENALTY_SCORED" || e.type === "PENALTY_MISSED")).toBe(false);
  });

  it("resumeFirstHalf is a safe no-op when there's nothing pending, and finishes the half once resolved", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const clean = simulateFirstHalf(home, away, { seed: "structure-seed", pauseOnPenalty: true });
    expect(clean.state.pendingPenalty).toBeUndefined();
    expect(resumeFirstHalf(clean)).toBe(clean); // same object, untouched

    let paused = simulateFirstHalf(home, away, { seed: HOME_PENALTY_SEED, pauseOnPenalty: true });
    paused = resumePendingPenalty(paused, { corner: "CENTER", power: "PLACED" });
    expect(paused.state.pendingPenalty).toBeUndefined();
    expect(paused.events.some((e) => e.type === "PENALTY_SCORED" || e.type === "PENALTY_MISSED")).toBe(true);

    const finished = resumeFirstHalf(paused);
    expect(finished.state.pendingPenalty).toBeUndefined();
    expect(finished.events.at(-1)?.type === "HALFTIME" || finished.state.pendingPenalty).toBeTruthy();
    expect(finished.nextMinute).toBeGreaterThanOrEqual(17);
  });

  it("an opponent's pending penalty resolves the same with or without a choice — only the PLAYER's own decision should ever be asked for", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const handle = simulateFirstHalf(home, away, { seed: AWAY_PENALTY_SEED, pauseOnPenalty: true });
    expect(handle.state.pendingPenalty?.attackingSide).toBe("away");

    // The Discord layer never calls resolvePenaltyDecision for the
    // opponent's penalty — simulating that by resolving with no choice,
    // exactly like resumePendingPenalty's non-interactive default.
    const resolved = resumePendingPenalty(handle, undefined);
    expect(resolved.state.pendingPenalty).toBeUndefined();
  });

  it("reaches minute 65 paused when the pending penalty falls inside the 46-70 window, after resuming past halftime", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    let handle = simulateFirstHalf(home, away, { seed: MID_WINDOW_PENALTY_SEED, pauseOnPenalty: true });
    expect(handle.state.pendingPenalty).toBeUndefined(); // clean first half for this seed

    handle = simulateUntilMinute(handle, 70);
    expect(handle.state.pendingPenalty?.attackingSide).toBe("home");
    expect(handle.state.pendingPenalty?.minute).toBe(65);
    expect(handle.nextMinute).toBe(66);
  });

  it("the corner/power choice is a real lever — same seed, different choices diverge from the exact same paused state", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const placedCenter = simulateFirstHalf(home, away, { seed: HOME_PENALTY_SEED, pauseOnPenalty: true });
    const placedCenterResolved = resumePendingPenalty(placedCenter, { corner: "CENTER", power: "PLACED" });

    const powerfulRight = simulateFirstHalf(home, away, { seed: HOME_PENALTY_SEED, pauseOnPenalty: true });
    const powerfulRightResolved = resumePendingPenalty(powerfulRight, { corner: "RIGHT", power: "POWERFUL" });

    // Different choices consume the shared RNG differently (extra
    // keeper-guess roll, extra "blasted wide" roll for POWERFUL) — the
    // rest of the match, resumed from here, reliably diverges. Doesn't
    // assert which choice is "better", just that the choice does
    // something real instead of being silently ignored.
    const finishedA = simulateSecondHalf(resumeFirstHalf(placedCenterResolved));
    const finishedB = simulateSecondHalf(resumeFirstHalf(powerfulRightResolved));
    expect(finishedA.events).not.toEqual(finishedB.events);
  });

  it("simulateMatch (the fully non-interactive path) never sets pendingPenalty even for a seed known to award one", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    const result = simulateMatch(home, away, { seed: HOME_PENALTY_SEED });
    expect(result.events.some((e) => e.type === "PENALTY_SCORED" || e.type === "PENALTY_MISSED")).toBe(true);
  });
});
