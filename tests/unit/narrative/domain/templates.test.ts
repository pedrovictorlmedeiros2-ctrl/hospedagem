import { describe, expect, it } from "vitest";
import { templateCoachMessage, templateInterviewAnswer, templateNewsArticle } from "../../../../src/narrative/domain/templates.js";
import type { CoachMessageFacts, InterviewFacts, RecordBrokenFacts } from "../../../../src/narrative/domain/narrativeFacts.js";

describe("templateNewsArticle", () => {
  it("mentions the previous holder when there was one", () => {
    const facts: RecordBrokenFacts = {
      kind: "RECORD_BROKEN",
      category: "HIGHEST_GLOBAL_RATING",
      holderNickname: "Novo",
      value: 1500,
      previousHolderNickname: "Antigo",
      previousValue: 1400,
    };

    const article = templateNewsArticle(facts);

    expect(article.headline).toContain("Novo");
    expect(article.body).toContain("Antigo");
    expect(article.body).toContain("1400");
  });

  it("announces a first-ever record when there was no previous holder", () => {
    const facts: RecordBrokenFacts = {
      kind: "RECORD_BROKEN",
      category: "MOST_GOALS_SEASON",
      holderNickname: "Pioneiro",
      value: 12,
      previousHolderNickname: null,
      previousValue: null,
    };

    const article = templateNewsArticle(facts);

    expect(article.body).toContain("primeiro recorde");
  });
});

describe("templateCoachMessage", () => {
  function baseFacts(overrides: Partial<CoachMessageFacts> = {}): CoachMessageFacts {
    return {
      kind: "COACH_MESSAGE",
      nickname: "Pedrinho",
      careerStage: "RESERVE",
      seasonMatches: 3,
      seasonGoals: 1,
      seasonAssists: 0,
      avgRating: 6.5,
      hasActiveInjury: false,
      ...overrides,
    };
  }

  it("tells an injured player to focus on recovering, not on stats", () => {
    const message = templateCoachMessage(baseFacts({ hasActiveInjury: true }));
    expect(message).toContain("recuperação");
  });

  it("praises a high average rating when not injured", () => {
    const message = templateCoachMessage(baseFacts({ avgRating: 8.2 }));
    expect(message).toContain("acima da média");
  });

  it("encourages more training for a modest average rating", () => {
    const message = templateCoachMessage(baseFacts({ avgRating: 6.0 }));
    expect(message).toContain("treinando com foco");
  });

  it("always includes the player's nickname and season numbers", () => {
    const message = templateCoachMessage(baseFacts({ seasonMatches: 5, seasonGoals: 2, seasonAssists: 3 }));
    expect(message).toContain("Pedrinho");
    expect(message).toContain("5 partida");
    expect(message).toContain("2 gol");
    expect(message).toContain("3 assistência");
  });
});

describe("templateInterviewAnswer", () => {
  it("echoes the question and grounds the answer in season facts", () => {
    const facts: InterviewFacts = {
      kind: "INTERVIEW",
      nickname: "Pedrinho",
      question: "Como foi a temporada?",
      careerStage: "STARTER",
      seasonMatches: 10,
      seasonGoals: 4,
      seasonAssists: 2,
      avgRating: 7.1,
    };

    const answer = templateInterviewAnswer(facts);

    expect(answer).toContain("Como foi a temporada?");
    expect(answer).toContain("10 partida");
    expect(answer).toContain("4 gol");
    expect(answer).toContain("7.1");
  });
});
