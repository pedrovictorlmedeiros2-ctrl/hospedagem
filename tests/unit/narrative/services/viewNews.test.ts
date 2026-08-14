import { describe, expect, it } from "vitest";
import { InMemoryNewsRepository } from "../../../../src/narrative/adapters/inMemoryNewsRepository.js";
import { viewNews } from "../../../../src/narrative/services/viewNews.js";

describe("viewNews", () => {
  it("defaults to the 5 most recent articles", async () => {
    const newsRepository = new InMemoryNewsRepository();
    for (let i = 0; i < 8; i++) {
      await newsRepository.publish({
        headline: `Notícia ${i}`,
        body: "b",
        facts: {},
        generatedByAi: false,
        publishedAt: new Date(2026, 7, i + 1),
      });
    }

    const view = await viewNews({ newsRepository });
    expect(view.rows).toHaveLength(5);
  });

  it("respects an explicit limit", async () => {
    const newsRepository = new InMemoryNewsRepository();
    await newsRepository.publish({
      headline: "Única",
      body: "b",
      facts: {},
      generatedByAi: false,
      publishedAt: new Date(),
    });

    const view = await viewNews({ newsRepository }, { limit: 1 });
    expect(view.rows).toHaveLength(1);
  });

  it("is empty when no news has been published", async () => {
    const view = await viewNews({ newsRepository: new InMemoryNewsRepository() });
    expect(view.rows).toHaveLength(0);
  });
});
