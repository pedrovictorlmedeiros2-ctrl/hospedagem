import { describe, expect, it } from "vitest";
import { seasonNameFor } from "../../../../src/career/domain/season.js";

describe("seasonNameFor", () => {
  it("zero-pads the number and includes an epithet", () => {
    expect(seasonNameFor(1)).toBe("SEASON 01 — THE BEGINNING");
    expect(seasonNameFor(2)).toBe("SEASON 02 — NEW HORIZONS");
  });

  it("cycles the epithet list instead of running out", () => {
    const name11 = seasonNameFor(11);
    const name1 = seasonNameFor(1);
    expect(name11.endsWith(name1.split("— ")[1] ?? "")).toBe(true);
    expect(name11.startsWith("SEASON 11")).toBe(true);
  });

  it("is deterministic for the same number", () => {
    expect(seasonNameFor(5)).toBe(seasonNameFor(5));
  });
});
