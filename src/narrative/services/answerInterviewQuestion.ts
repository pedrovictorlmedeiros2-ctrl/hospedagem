import { ensureCareerStarted, type EnsureCareerStartedDeps } from "../../career/services/ensureCareerStarted.js";
import type { MatchRepository } from "../../game/ports/matchRepository.js";
import { ValidationError } from "../../shared/errors.js";
import type { InterviewFacts } from "../domain/narrativeFacts.js";
import type { NarrativeGenerator } from "../ports/narrativeGenerator.js";

const MAX_QUESTION_LENGTH = 300;

export interface AnswerInterviewQuestionDeps extends EnsureCareerStartedDeps {
  matchRepository: MatchRepository;
  narrativeGenerator: NarrativeGenerator;
}

export interface AnswerInterviewQuestionInput {
  discordId: string;
  question: string;
}

export interface AnswerInterviewQuestionOutput {
  answer: string;
}

export async function answerInterviewQuestion(
  deps: AnswerInterviewQuestionDeps,
  input: AnswerInterviewQuestionInput,
): Promise<AnswerInterviewQuestionOutput> {
  const question = input.question.trim();
  if (question.length === 0) {
    throw new ValidationError("A pergunta não pode estar vazia.");
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new ValidationError(`A pergunta é longa demais (máximo ${MAX_QUESTION_LENGTH} caracteres).`);
  }

  const { player, career, season } = await ensureCareerStarted(deps, input.discordId);
  const seasonStat = await deps.matchRepository.getPlayerSeasonStat(player.id, season.id);

  const facts: InterviewFacts = {
    kind: "INTERVIEW",
    nickname: player.nickname,
    question,
    careerStage: career.stage,
    seasonMatches: seasonStat?.matches ?? 0,
    seasonGoals: seasonStat?.goals ?? 0,
    seasonAssists: seasonStat?.assists ?? 0,
    avgRating: seasonStat?.avgRating ?? 0,
  };

  const answer = await deps.narrativeGenerator.generateInterviewAnswer(facts);
  return { answer };
}
