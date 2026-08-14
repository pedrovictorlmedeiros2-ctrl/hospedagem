import { describe, expect, it } from "vitest";
import { redactError, redactSecrets } from "../../src/shared/redact.js";

describe("redactSecrets", () => {
  it("scrubs a Postgres connection string's credentials", () => {
    const text = redactSecrets("connect failed: postgresql://myuser:s3cr3t@db.internal:5432/football");
    expect(text).not.toContain("myuser");
    expect(text).not.toContain("s3cr3t");
    expect(text).toContain("postgresql://***:***@db.internal:5432/football");
  });

  it("scrubs a literal known secret value wherever it appears", () => {
    const text = redactSecrets("bot login failed with token abc123.def456", ["abc123.def456"]);
    expect(text).not.toContain("abc123.def456");
    expect(text).toContain("***");
  });

  it("leaves ordinary text untouched", () => {
    const text = redactSecrets("player profile not found for discordId 12345");
    expect(text).toBe("player profile not found for discordId 12345");
  });

  it("ignores empty-string secrets instead of scrubbing everything", () => {
    const text = redactSecrets("some normal error message", [""]);
    expect(text).toBe("some normal error message");
  });
});

describe("redactError", () => {
  it("redacts an Error's message and stack, preserving its name", () => {
    const error = new Error("postgresql://myuser:s3cr3t@db.internal:5432/football is unreachable");
    error.name = "PrismaClientInitializationError";

    const redacted = redactError(error);

    expect(redacted).toBeInstanceOf(Error);
    const redactedError = redacted as Error;
    expect(redactedError.name).toBe("PrismaClientInitializationError");
    expect(redactedError.message).not.toContain("s3cr3t");
    expect(redactedError.stack ?? "").not.toContain("s3cr3t");
  });

  it("redacts a plain string error", () => {
    const redacted = redactError("token GROQTOKEN123 rejected", ["GROQTOKEN123"]);
    expect(redacted).toBe("token *** rejected");
  });

  it("passes through non-Error, non-string values unchanged", () => {
    const value = { code: "P2002" };
    expect(redactError(value)).toBe(value);
  });
});
