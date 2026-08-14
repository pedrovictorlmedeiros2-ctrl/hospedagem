import { describe, expect, it } from "vitest";
import { InMemoryCareerRepository } from "../../../../src/career/adapters/inMemoryCareerRepository.js";
import { InMemoryCompetitionRepository } from "../../../../src/competitions/adapters/inMemoryCompetitionRepository.js";
import { InMemoryMatchRepository } from "../../../../src/game/adapters/inMemoryMatchRepository.js";
import { InMemoryUserRepository } from "../../../../src/identity/adapters/inMemoryUserRepository.js";
import { TemplateNarrativeGenerator } from "../../../../src/narrative/adapters/templateNarrativeGenerator.js";
import { answerInterviewQuestion } from "../../../../src/narrative/services/answerInterviewQuestion.js";
import { InMemoryPlayerRepository } from "../../../../src/player/adapters/inMemoryPlayerRepository.js";
import { createPlayerProfile, type CreatePlayerProfileInput } from "../../../../src/player/services/createPlayerProfile.js";
import { ValidationError } from "../../../../src/shared/errors.js";

function makeDeps() {
  return {
    userRepository: new InMemoryUserRepository(),
    playerRepository: new InMemoryPlayerRepository(),
    careerRepository: new InMemoryCareerRepository(),
    competitionRepository: new InMemoryCompetitionRepository(),
    matchRepository: new InMemoryMatchRepository(),
    narrativeGenerator: new TemplateNarrativeGenerator(),
  };
}

function profileInput(overrides: Partial<CreatePlayerProfileInput> = {}): CreatePlayerProfileInput {
  return {
    discordId: "discord-1",
    name: "Pedro Medeiros",
    nickname: "Pedrinho",
    nationality: "BR",
    age: 20,
    position: "ST",
    preferredFoot: "RIGHT",
    heightCm: 180,
    playStyle: "POACHER",
    shirtNumber: 9,
    ...overrides,
  };
}

describe("answerInterviewQuestion", () => {
  it("echoes the question back inside the answer", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    const { answer } = await answerInterviewQuestion(deps, {
      discordId: "discord-1",
      question: "Como você está se sentindo?",
    });

    expect(answer).toContain("Como você está se sentindo?");
  });

  it("rejects an empty question", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    await expect(answerInterviewQuestion(deps, { discordId: "discord-1", question: "   " })).rejects.toThrow(ValidationError);
  });

  it("rejects a question over the length limit", async () => {
    const deps = makeDeps();
    await createPlayerProfile(deps, profileInput());

    await expect(
      answerInterviewQuestion(deps, { discordId: "discord-1", question: "a".repeat(301) }),
    ).rejects.toThrow(ValidationError);
  });
});
