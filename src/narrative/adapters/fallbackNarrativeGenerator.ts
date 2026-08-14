import type { Logger } from "../../shared/logger.js";
import type { CoachMessageFacts, InterviewFacts, RecordBrokenFacts } from "../domain/narrativeFacts.js";
import type { NarrativeGenerator, NewsArticle } from "../ports/narrativeGenerator.js";

/**
 * Decorator: tries `primary` (Groq) first, and falls back to `fallback`
 * (deterministic templates) on ANY failure — network error, timeout,
 * malformed output. This is the seam that keeps an unavailable or
 * misbehaving LLM from ever breaking a Discord command or a queued news
 * article; see RISK_REGISTER.md risco #5 and ADR 0001, adenda Fase 10.
 */
export class FallbackNarrativeGenerator implements NarrativeGenerator {
  constructor(
    private readonly primary: NarrativeGenerator,
    private readonly fallback: NarrativeGenerator,
    private readonly logger: Logger,
  ) {}

  async generateNewsArticle(facts: RecordBrokenFacts): Promise<NewsArticle> {
    try {
      return await this.primary.generateNewsArticle(facts);
    } catch (error) {
      this.logger.warn({ error }, "Groq falhou gerando notícia — usando fallback determinístico");
      return this.fallback.generateNewsArticle(facts);
    }
  }

  async generateCoachMessage(facts: CoachMessageFacts): Promise<string> {
    try {
      return await this.primary.generateCoachMessage(facts);
    } catch (error) {
      this.logger.warn({ error }, "Groq falhou gerando mensagem do treinador — usando fallback determinístico");
      return this.fallback.generateCoachMessage(facts);
    }
  }

  async generateInterviewAnswer(facts: InterviewFacts): Promise<string> {
    try {
      return await this.primary.generateInterviewAnswer(facts);
    } catch (error) {
      this.logger.warn({ error }, "Groq falhou gerando resposta de entrevista — usando fallback determinístico");
      return this.fallback.generateInterviewAnswer(facts);
    }
  }
}
