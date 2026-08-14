import { describe, expect, it } from "vitest";
import { canonicalizeRivalryPair } from "../../../../src/global/domain/rivalry.js";

describe("canonicalizeRivalryPair", () => {
  it("returns the same pair regardless of call order", () => {
    expect(canonicalizeRivalryPair("player-a", "player-b")).toEqual(canonicalizeRivalryPair("player-b", "player-a"));
  });

  it("is lexicographically sorted", () => {
    expect(canonicalizeRivalryPair("player-z", "player-a")).toEqual(["player-a", "player-z"]);
  });
});
