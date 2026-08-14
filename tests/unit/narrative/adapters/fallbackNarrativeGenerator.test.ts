import { describe, expect, it, vi } from "vitest";
import { FallbackNarrativeGenerator } from "../../../../src/narrative/adapters/fallbackNarrativeGenerator.js";
import { TemplateNarrativeGenerator } from "../../../../src/narrative/adapters/templateNarrativeGenerator.js";
import type { CoachMessageFacts, InterviewFacts, RecordBrokenFacts } from "../../../../src/narrative/domain/narrativeFacts.js";
import type { NarrativeGenerator } from "../../../../src/narrative/ports/narrativeGenerator.js";
import type { Logger } from "../../../../src/shared/logger.js";

function fakeLogger(): Logger {
  return { debug: () => {}, error: () => {}, warn: () => {}, info: () => {} } as unknown as Logger;
}

function alwaysThrowingGenerator(): NarrativeGenerator {
  return {
    generateNewsArticle: () => Promise.reject(new Error("Groq indisponível")),
    generateCoachMessage: () => Promise.reject(new Error("Groq indisponível")),
    generateInterviewAnswer: () => Promise.reject(new Error("Groq indisponível")),
  };
}

const recordFacts: RecordBrokenFacts = {
  kind: "RECORD_BROKEN",
  category: "HIGHEST_GLOBAL_RATING",
  holderNickname: "Novo",
  value: 1500,
  previousHolderNickname: null,
  previousValue: null,
};

const coachFacts: CoachMessageFacts = {
  kind: "COACH_MESSAGE",
  nickname: "Pedrinho",
  careerStage: "RESERVE",
  seasonMatches: 3,
  seasonGoals: 1,
  seasonAssists: 0,
  avgRating: 6.5,
  hasActiveInjury: false,
};

const interviewFacts: InterviewFacts = {
  kind: "INTERVIEW",
  nickname: "Pedrinho",
  question: "Como foi a partida?",
  careerStage: "STARTER",
  seasonMatches: 10,
  seasonGoals: 4,
  seasonAssists: 2,
  avgRating: 7.1,
};

describe("FallbackNarrativeGenerator", () => {
  it("uses the primary generator's output when it succeeds", async () => {
    const primary: NarrativeGenerator = {
      generateNewsArticle: () => Promise.resolve({ headline: "H", body: "B", generatedByAi: true }),
      generateCoachMessage: () => Promise.resolve("coach ok"),
      generateInterviewAnswer: () => Promise.resolve("answer ok"),
    };
    const generator = new FallbackNarrativeGenerator(primary, new TemplateNarrativeGenerator(), fakeLogger());

    const article = await generator.generateNewsArticle(recordFacts);
    expect(article).toEqual({ headline: "H", body: "B", generatedByAi: true });
  });

  it("falls back to the template generator when the primary throws, for all three methods", async () => {
    const generator = new FallbackNarrativeGenerator(alwaysThrowingGenerator(), new TemplateNarrativeGenerator(), fakeLogger());

    const article = await generator.generateNewsArticle(recordFacts);
    expect(article.generatedByAi).toBe(false);
    expect(article.headline).toContain("Novo");

    const coachMessage = await generator.generateCoachMessage(coachFacts);
    expect(coachMessage).toContain("Pedrinho");

    const interviewAnswer = await generator.generateInterviewAnswer(interviewFacts);
    expect(interviewAnswer).toContain("Como foi a partida?");
  });

  it("logs a warning when falling back, instead of failing silently", async () => {
    const warn = vi.fn();
    const logger = { debug: () => {}, error: () => {}, warn, info: () => {} } as unknown as Logger;
    const generator = new FallbackNarrativeGenerator(alwaysThrowingGenerator(), new TemplateNarrativeGenerator(), logger);

    await generator.generateCoachMessage(coachFacts);

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
