import { describe, expect, it } from "vitest";
import { isNewRecord } from "../../../../src/global/domain/records.js";

describe("isNewRecord", () => {
  it("is always a new record when there's no current holder", () => {
    expect(isNewRecord(null, 1)).toBe(true);
  });

  it("requires strictly beating the current value, not matching it", () => {
    expect(isNewRecord({ holderPlayerId: "p1", value: 10 }, 10)).toBe(false);
    expect(isNewRecord({ holderPlayerId: "p1", value: 10 }, 11)).toBe(true);
    expect(isNewRecord({ holderPlayerId: "p1", value: 10 }, 9)).toBe(false);
  });
});
