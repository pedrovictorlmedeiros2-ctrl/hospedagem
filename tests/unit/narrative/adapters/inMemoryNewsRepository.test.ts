import { describe, expect, it } from "vitest";
import { InMemoryNewsRepository } from "../../../../src/narrative/adapters/inMemoryNewsRepository.js";

describe("InMemoryNewsRepository", () => {
  it("returns the most recently published article first", async () => {
    const repository = new InMemoryNewsRepository();
    await repository.publish({
      headline: "Primeira",
      body: "b1",
      facts: {},
      generatedByAi: false,
      publishedAt: new Date("2026-08-01T00:00:00Z"),
    });
    await repository.publish({
      headline: "Segunda",
      body: "b2",
      facts: {},
      generatedByAi: false,
      publishedAt: new Date("2026-08-14T00:00:00Z"),
    });

    const rows = await repository.listRecent(10);

    expect(rows[0]?.headline).toBe("Segunda");
    expect(rows[1]?.headline).toBe("Primeira");
  });

  it("respects the limit", async () => {
    const repository = new InMemoryNewsRepository();
    for (let i = 0; i < 5; i++) {
      await repository.publish({
        headline: `Notícia ${i}`,
        body: "b",
        facts: {},
        generatedByAi: false,
        publishedAt: new Date(2026, 7, i + 1),
      });
    }

    const rows = await repository.listRecent(2);
    expect(rows).toHaveLength(2);
  });

  it("is empty when nothing has been published yet", async () => {
    const repository = new InMemoryNewsRepository();
    const rows = await repository.listRecent(10);
    expect(rows).toHaveLength(0);
  });
});
