import { describe, expect, it, beforeEach } from "vitest";
import { loadEnv, resetEnvCacheForTests } from "../../src/config/env.js";

const validEnv = {
  DISCORD_BOT_TOKEN: "token",
  DISCORD_CLIENT_ID: "client-id",
  DATABASE_URL: "postgresql://localhost:5432/test",
};

describe("loadEnv", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
  });

  it("parses a valid environment and fills in defaults", () => {
    const env = loadEnv(validEnv);

    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.DISCORD_BOT_TOKEN).toBe("token");
  });

  it("throws a descriptive error when a required variable is missing", () => {
    const { DISCORD_BOT_TOKEN: _omit, ...incomplete } = validEnv;

    expect(() => loadEnv(incomplete)).toThrow(/DISCORD_BOT_TOKEN/);
  });

  it("caches the parsed result across calls", () => {
    const first = loadEnv(validEnv);
    const second = loadEnv({ ...validEnv, DISCORD_BOT_TOKEN: "different" });

    expect(second).toBe(first);
    expect(second.DISCORD_BOT_TOKEN).toBe("token");
  });
});
