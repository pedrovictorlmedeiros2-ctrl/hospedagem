import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../src/shared/eventBus.js";
import type { Logger } from "../../src/shared/logger.js";

function fakeLogger(): Logger {
  return { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() } as unknown as Logger;
}

describe("EventBus", () => {
  it("delivers the payload to a subscriber", () => {
    const bus = new EventBus(fakeLogger());
    const handler = vi.fn();

    bus.on("PLAYER_CREATED", handler);
    bus.emit("PLAYER_CREATED", { playerId: "p1", userId: "u1" });

    expect(handler).toHaveBeenCalledWith({ playerId: "p1", userId: "u1" });
  });

  it("supports multiple independent subscribers for the same event", () => {
    const bus = new EventBus(fakeLogger());
    const first = vi.fn();
    const second = vi.fn();

    bus.on("MATCH_FINISHED", first);
    bus.on("MATCH_FINISHED", second);
    bus.emit("MATCH_FINISHED", { matchId: "m1", homeScore: 2, awayScore: 1 });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("logs and swallows a handler error instead of crashing the process", async () => {
    const logger = fakeLogger();
    const bus = new EventBus(logger);
    bus.on("PLAYER_CREATED", () => {
      throw new Error("boom");
    });

    bus.emit("PLAYER_CREATED", { playerId: "p1", userId: "u1" });

    // the throwing handler runs synchronously but is wrapped in
    // Promise.resolve().catch(...), so let the microtask queue flush.
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "PLAYER_CREATED" }),
      expect.any(String),
    );
  });
});
