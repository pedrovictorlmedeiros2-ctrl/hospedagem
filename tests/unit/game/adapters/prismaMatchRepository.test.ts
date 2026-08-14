import { describe, expect, it } from "vitest";
import { toPrismaEventType } from "../../../../src/game/adapters/prismaMatchRepository.js";
import type { SimMatchEventType } from "../../../../src/game/domain/types.js";

const ALL_SIM_EVENT_TYPES: SimMatchEventType[] = [
  "KICKOFF",
  "GOAL",
  "OWN_GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "SUBSTITUTION",
  "INJURY",
  "PENALTY_SCORED",
  "PENALTY_MISSED",
  "CORNER",
  "OFFSIDE",
  "HALFTIME",
  "FULLTIME",
];

describe("toPrismaEventType", () => {
  it("maps every persistable sim event type to a schema MatchEventType", () => {
    const persistable = ALL_SIM_EVENT_TYPES.filter(
      (type) => !["KICKOFF", "HALFTIME", "FULLTIME"].includes(type),
    );
    for (const type of persistable) {
      expect(toPrismaEventType(type), `${type} should map to a schema value`).not.toBeNull();
    }
  });

  it("intentionally drops presentation-only events (kickoff/halftime/fulltime) instead of guessing a schema value", () => {
    expect(toPrismaEventType("KICKOFF")).toBeNull();
    expect(toPrismaEventType("HALFTIME")).toBeNull();
    expect(toPrismaEventType("FULLTIME")).toBeNull();
  });
});
