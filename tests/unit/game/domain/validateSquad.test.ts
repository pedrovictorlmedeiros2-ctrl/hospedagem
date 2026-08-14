import { describe, expect, it } from "vitest";
import { generateSquad } from "../../../../src/game/domain/generateSquad.js";
import { createRng } from "../../../../src/game/domain/rng.js";
import { InvalidSquadError, validateSquad } from "../../../../src/game/domain/validateSquad.js";
import type { MatchSquad } from "../../../../src/game/domain/types.js";

function validSquad(): MatchSquad {
  return generateSquad({ teamId: "t1", teamName: "Time Teste", style: "TACTICAL", avgOverall: 60, rng: createRng("squad-seed") });
}

describe("validateSquad", () => {
  it("accepts a well-formed squad", () => {
    expect(() => validateSquad(validSquad())).not.toThrow();
  });

  it("rejects a squad with fewer than 11 players", () => {
    const squad = validSquad();
    squad.players = squad.players.slice(0, 10);
    expect(() => validateSquad(squad)).toThrow(InvalidSquadError);
  });

  it("rejects a squad with no goalkeeper among the starters", () => {
    const squad = validSquad();
    squad.players[0] = { ...squad.players[0], position: "CB" } as (typeof squad.players)[number];
    expect(() => validateSquad(squad)).toThrow(InvalidSquadError);
  });

  it("rejects a squad with two goalkeepers among the starters", () => {
    const squad = validSquad();
    squad.players[1] = { ...squad.players[1], position: "GK" } as (typeof squad.players)[number];
    expect(() => validateSquad(squad)).toThrow(InvalidSquadError);
  });

  it("rejects a squad with a duplicate player id", () => {
    const squad = validSquad();
    squad.players[1] = { ...squad.players[1], id: squad.players[0]?.id } as (typeof squad.players)[number];
    expect(() => validateSquad(squad)).toThrow(InvalidSquadError);
  });
});
