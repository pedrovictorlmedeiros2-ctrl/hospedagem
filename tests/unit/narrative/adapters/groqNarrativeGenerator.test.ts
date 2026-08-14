import { describe, expect, it } from "vitest";
import type { GroqChatClient } from "../../../../src/narrative/adapters/groqNarrativeGenerator.js";
import { GroqNarrativeGenerator } from "../../../../src/narrative/adapters/groqNarrativeGenerator.js";
import type { CoachMessageFacts, InterviewFacts, RecordBrokenFacts } from "../../../../src/narrative/domain/narrativeFacts.js";

function fakeClient(content: string | null | undefined): GroqChatClient {
  return {
    chat: {
      completions: {
        create: () =>
          Promise.resolve({
            choices: [{ message: content === undefined ? {} : { content } }],
          }),
      },
    },
  };
}

const recordFacts: RecordBrokenFacts = {
  kind: "RECORD_BROKEN",
  category: "HIGHEST_GLOBAL_RATING",
  holderNickname: "Novo",
  value: 1500,
  previousHolderNickname: "Antigo",
  previousValue: 1400,
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

describe("GroqNarrativeGenerator", () => {
  it("splits a well-formed news completion into headline (first line) and body (rest)", async () => {
    const generator = new GroqNarrativeGenerator(fakeClient("Título da notícia\nCorpo da notícia em uma frase."));
    const article = await generator.generateNewsArticle(recordFacts);

    expect(article.headline).toBe("Título da notícia");
    expect(article.body).toBe("Corpo da notícia em uma frase.");
    expect(article.generatedByAi).toBe(true);
  });

  it("throws when Groq returns a single-line completion (no headline/body split)", async () => {
    const generator = new GroqNarrativeGenerator(fakeClient("Só uma linha, sem corpo"));
    await expect(generator.generateNewsArticle(recordFacts)).rejects.toThrow();
  });

  it("throws when Groq returns an empty completion", async () => {
    const generator = new GroqNarrativeGenerator(fakeClient(""));
    await expect(generator.generateCoachMessage(coachFacts)).rejects.toThrow(/vazia/);
  });

  it("throws when Groq returns no content at all", async () => {
    const generator = new GroqNarrativeGenerator(fakeClient(undefined));
    await expect(generator.generateInterviewAnswer(interviewFacts)).rejects.toThrow(/vazia/);
  });

  it("returns the raw completion text for a coach message", async () => {
    const generator = new GroqNarrativeGenerator(fakeClient("Vai com tudo, você está pronto!"));
    const message = await generator.generateCoachMessage(coachFacts);
    expect(message).toBe("Vai com tudo, você está pronto!");
  });

  it("returns the raw completion text for an interview answer", async () => {
    const generator = new GroqNarrativeGenerator(fakeClient("Foi um jogo duro, mas demos nosso melhor."));
    const answer = await generator.generateInterviewAnswer(interviewFacts);
    expect(answer).toBe("Foi um jogo duro, mas demos nosso melhor.");
  });
});
