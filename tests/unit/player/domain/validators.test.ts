import { describe, expect, it } from "vitest";
import { ValidationError } from "../../../../src/shared/errors.js";
import {
  assertKnownChoice,
  validateAge,
  validateBio,
  validateCelebration,
  validateHeightCm,
  validateHexColor,
  validateNationality,
  validateNickname,
  validatePlayerName,
  validateShirtNumber,
} from "../../../../src/player/domain/validators.js";

describe("validatePlayerName", () => {
  it("accepts a normal accented name", () => {
    expect(() => validatePlayerName("José da Silva")).not.toThrow();
  });

  it("rejects a 1-character name", () => {
    expect(() => validatePlayerName("A")).toThrow(ValidationError);
  });

  it("rejects a name with digits", () => {
    expect(() => validatePlayerName("Pedro123")).toThrow(ValidationError);
  });

  it("rejects a name over 40 characters", () => {
    expect(() => validatePlayerName("A".repeat(41))).toThrow(ValidationError);
  });
});

describe("validateNickname", () => {
  it("accepts letters, numbers, underscore and hyphen", () => {
    expect(() => validateNickname("Pedro_10-Prime")).not.toThrow();
  });

  it("rejects an empty nickname", () => {
    expect(() => validateNickname("")).toThrow(ValidationError);
  });

  it("rejects a nickname with disallowed punctuation", () => {
    expect(() => validateNickname("Pedro!!")).toThrow(ValidationError);
  });
});

describe("validateNationality", () => {
  it("accepts a known ISO code", () => {
    expect(() => validateNationality("BR")).not.toThrow();
  });

  it("rejects an unknown code", () => {
    expect(() => validateNationality("ZZ")).toThrow(ValidationError);
  });

  it("rejects a lowercase code", () => {
    expect(() => validateNationality("br")).toThrow(ValidationError);
  });
});

describe("validateAge", () => {
  it("accepts the boundary values", () => {
    expect(() => validateAge(15)).not.toThrow();
    expect(() => validateAge(45)).not.toThrow();
  });

  it("rejects below the minimum", () => {
    expect(() => validateAge(14)).toThrow(ValidationError);
  });

  it("rejects above the maximum", () => {
    expect(() => validateAge(46)).toThrow(ValidationError);
  });

  it("rejects a non-integer age", () => {
    expect(() => validateAge(20.5)).toThrow(ValidationError);
  });
});

describe("validateHeightCm", () => {
  it("rejects an unrealistically low height", () => {
    expect(() => validateHeightCm(50)).toThrow(ValidationError);
  });

  it("accepts a realistic height", () => {
    expect(() => validateHeightCm(180)).not.toThrow();
  });
});

describe("validateShirtNumber", () => {
  it("allows a null/undefined number (optional field)", () => {
    expect(() => validateShirtNumber(null)).not.toThrow();
    expect(() => validateShirtNumber(undefined)).not.toThrow();
  });

  it("rejects 0 and 100", () => {
    expect(() => validateShirtNumber(0)).toThrow(ValidationError);
    expect(() => validateShirtNumber(100)).toThrow(ValidationError);
  });

  it("accepts a valid number", () => {
    expect(() => validateShirtNumber(10)).not.toThrow();
  });
});

describe("validateBio / validateCelebration", () => {
  it("rejects a bio over 140 characters", () => {
    expect(() => validateBio("a".repeat(141))).toThrow(ValidationError);
  });

  it("rejects a celebration over 60 characters", () => {
    expect(() => validateCelebration("a".repeat(61))).toThrow(ValidationError);
  });
});

describe("validateHexColor", () => {
  it("accepts a valid hex color", () => {
    expect(() => validateHexColor("#1E90FF", "Cor principal")).not.toThrow();
  });

  it("rejects a color without #", () => {
    expect(() => validateHexColor("1E90FF", "Cor principal")).toThrow(ValidationError);
  });

  it("rejects a 3-digit shorthand hex", () => {
    expect(() => validateHexColor("#FFF", "Cor principal")).toThrow(ValidationError);
  });
});

describe("assertKnownChoice", () => {
  it("accepts a value in the list", () => {
    expect(() => assertKnownChoice("gold", ["bronze", "silver", "gold"], "Moldura")).not.toThrow();
  });

  it("rejects a value outside the list", () => {
    expect(() => assertKnownChoice("diamond", ["bronze", "silver", "gold"], "Moldura")).toThrow(
      ValidationError,
    );
  });
});
