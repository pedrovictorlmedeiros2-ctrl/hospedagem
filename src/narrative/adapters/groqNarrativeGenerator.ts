import { CAREER_STAGE_LABELS } from "../../career/domain/labels.js";
import { RECORD_CATEGORY_LABELS } from "../../global/domain/records.js";
import type { CoachMessageFacts, InterviewFacts, RecordBrokenFacts } from "../domain/narrativeFacts.js";
import type { NarrativeGenerator, NewsArticle } from "../ports/narrativeGenerator.js";

/**
 * Narrow slice of the groq-sdk client surface this adapter actually calls —
 * deliberately decoupled from the concrete `Groq` class (same DI pattern as
 * every Prisma-backed port in this codebase) so tests can inject a fake
 * client instead of hitting the network.
 */
export interface GroqChatClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        messages: { role: "system" | "user"; content: string }[];
        temperature?: number;
        max_tokens?: number;
      }): Promise<{ choices: { message?: { content?: string | null } }[] }>;
    };
  };
}

const DEFAULT_MODEL = "llama-3.1-8b-instant";

/**
 * Real, Groq-backed implementation. Implemented and typechecked but NOT
 * validated against the live Groq API in this environment — no
 * GROQ_API_KEY was available to run it end-to-end. See docs/ROADMAP.md.
 * Every failure mode (network error, empty completion, malformed output)
 * surfaces as a thrown error — this adapter never invents placeholder
 * text itself; that's FallbackNarrativeGenerator's job.
 */
export class GroqNarrativeGenerator implements NarrativeGenerator {
  constructor(
    private readonly client: GroqChatClient,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  private async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("Groq retornou uma resposta vazia");
    }
    return text;
  }

  async generateNewsArticle(facts: RecordBrokenFacts): Promise<NewsArticle> {
    const label = RECORD_CATEGORY_LABELS[facts.category];
    const priorRecordLine =
      facts.previousHolderNickname !== null && facts.previousValue !== null
        ? `Recorde anterior era de ${facts.previousHolderNickname}, com ${facts.previousValue.toFixed(0)}.`
        : "Este é o primeiro recorde já registrado nessa categoria.";

    const raw = await this.complete(
      "Você é um redator esportivo brasileiro. Responda em português do Brasil. " +
        "A PRIMEIRA linha da resposta deve conter APENAS o título da notícia (sem aspas, sem markdown). " +
        "As linhas seguintes são o corpo da notícia, em até 3 frases curtas.",
      `Recorde mundial quebrado: "${label}". Novo dono: ${facts.holderNickname}, com marca de ${facts.value.toFixed(0)}. ${priorRecordLine}`,
    );

    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const [headline, ...rest] = lines;
    const body = rest.join(" ");
    if (!headline || !body) {
      throw new Error("Groq não retornou título e corpo separados por linha");
    }

    return { headline, body, generatedByAi: true };
  }

  async generateCoachMessage(facts: CoachMessageFacts): Promise<string> {
    const stageLabel = CAREER_STAGE_LABELS[facts.careerStage];
    return this.complete(
      "Você é o técnico de um jogador de futebol amador em ascensão. Fale diretamente com ele, " +
        "em português do Brasil, em tom motivador mas realista, em no máximo 3 frases curtas.",
      `Jogador: ${facts.nickname}. Estágio: ${stageLabel}. Temporada: ${facts.seasonMatches} partida(s), ` +
        `${facts.seasonGoals} gol(s), ${facts.seasonAssists} assistência(s), nota média ${facts.avgRating.toFixed(1)}. ` +
        `Lesionado agora: ${facts.hasActiveInjury ? "sim" : "não"}.`,
    );
  }

  async generateInterviewAnswer(facts: InterviewFacts): Promise<string> {
    const stageLabel = CAREER_STAGE_LABELS[facts.careerStage];
    return this.complete(
      "Você É o jogador de futebol sendo entrevistado — responda em primeira pessoa, em português do Brasil, " +
        "em tom natural e humilde, em no máximo 3 frases curtas.",
      `Você é ${facts.nickname}, estágio ${stageLabel}, ${facts.seasonMatches} partida(s) na temporada, ` +
        `${facts.seasonGoals} gol(s), nota média ${facts.avgRating.toFixed(1)}. O repórter perguntou: "${facts.question}"`,
    );
  }
}
