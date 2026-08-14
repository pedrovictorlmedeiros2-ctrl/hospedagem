import { describe, expect, it } from "vitest";
import { tierForRating } from "../../../../src/multiplayer/domain/tier.js";

describe("tierForRating", () => {
  it("classifies bands correctly", () => {
    expect(tierForRating(500)).toBe("BRONZE");
    expect(tierForRating(999)).toBe("BRONZE");
    expect(tierForRating(1000)).toBe("SILVER");
    expect(tierForRating(1299)).toBe("SILVER");
    expect(tierForRating(1300)).toBe("GOLD");
    expect(tierForRating(1599)).toBe("GOLD");
    expect(tierForRating(1600)).toBe("ELITE");
    expect(tierForRating(2000)).toBe("ELITE");
  });

  it("places a fresh player's starting rating in SILVER", () => {
    expect(tierForRating(1000)).toBe("SILVER");
  });
});
