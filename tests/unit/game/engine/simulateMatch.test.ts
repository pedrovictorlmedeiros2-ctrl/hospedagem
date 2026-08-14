import { describe, expect, it } from "vitest";
import { generateSquad } from "../../../../src/game/domain/generateSquad.js";
import { createRng } from "../../../../src/game/domain/rng.js";
import type { MatchSquad, SimMatchEventType } from "../../../../src/game/domain/types.js";
import { InvalidSquadError } from "../../../../src/game/domain/validateSquad.js";
import { simulateMatch } from "../../../../src/game/engine/simulateMatch.js";

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

    expect(result.events.some((event) => event.type === "HALFTIME" && event.minute === 45)).toBe(true);
  });

  it("rejects an invalid squad instead of silently simulating garbage", () => {
    const home = squad("home", "Casa", 60, "home-seed");
    const away = squad("away", "Visitante", 60, "away-seed");
    away.players = away.players.slice(0, 5);

    expect(() => simulateMatch(home, away, { seed: "invalid-seed" })).toThrow(InvalidSquadError);
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
    const strongKeeperTeam = generateSquad({ teamId: "gk-strong", teamName: "GK Forte", style: "TACTICAL", avgOverall: 60, rng: baseRng() });
    const weakKeeperTeam = generateSquad({ teamId: "gk-weak", teamName: "GK Fraco", style: "TACTICAL", avgOverall: 60, rng: baseRng() });

    const gkAttrs = { gkReflexes: 95, gkPositioning: 95, gkHandling: 95, gkAerial: 95, gkOneOnOne: 95, gkPenalties: 95 };
    const weakGkAttrs = { gkReflexes: 15, gkPositioning: 15, gkHandling: 15, gkAerial: 15, gkOneOnOne: 15, gkPenalties: 15 };
    strongKeeperTeam.players[0] = { ...strongKeeperTeam.players[0], ...gkAttrs } as (typeof strongKeeperTeam.players)[number];
    weakKeeperTeam.players[0] = { ...weakKeeperTeam.players[0], ...weakGkAttrs } as (typeof weakKeeperTeam.players)[number];

    const attacker = squad("attacker", "Ataque", 65, "attacker-seed");

    let goalsAgainstStrongGk = 0;
    let goalsAgainstWeakGk = 0;
    for (let i = 0; i < TRIALS; i++) {
      goalsAgainstStrongGk += simulateMatch(attacker, strongKeeperTeam, { seed: `strong-gk-${i}` }).homeScore;
      goalsAgainstWeakGk += simulateMatch(attacker, weakKeeperTeam, { seed: `weak-gk-${i}` }).homeScore;
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
      expect(seen.has(type), `expected ${type} to occur at least once across 150 matches`).toBe(true);
    }
  });

  it("never fields an empty squad — a red-carded or injured player without a sub still leaves a non-empty team", () => {
    const home = squad("home", "Casa", 65, "home-seed");
    const away = squad("away", "Visitante", 65, "away-seed");

    for (let i = 0; i < 30; i++) {
      const result = simulateMatch(home, away, { seed: `safety-${i}` });
      const homeMinutes = result.playerStats.filter((p) => p.side === "home").reduce((sum, p) => sum + p.minutesPlayed, 0);
      const awayMinutes = result.playerStats.filter((p) => p.side === "away").reduce((sum, p) => sum + p.minutesPlayed, 0);
      expect(homeMinutes).toBeGreaterThan(0);
      expect(awayMinutes).toBeGreaterThan(0);
    }
  });
});
