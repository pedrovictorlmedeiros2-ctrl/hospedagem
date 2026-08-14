import type { CoachMessageFacts, InterviewFacts, RecordBrokenFacts } from "../domain/narrativeFacts.js";

export interface NewsArticle {
  headline: string;
  body: string;
  /** True when an LLM actually wrote this text; false for the deterministic template fallback — mirrors News.generatedByAi. */
  generatedByAi: boolean;
}

/**
 * The narrative layer, isolated behind this port. NEVER called on the
 * gameplay-critical path — match resolution, economy and rating are 100%
 * deterministic engine code that does not depend on this interface (see
 * ADR 0001, adenda Fase 10, and RISK_REGISTER.md risco #5). Implementations
 * must never throw for a caller that only wants best-effort flavor text —
 * see adapters/fallbackNarrativeGenerator.ts for the seam that guarantees
 * that.
 */
export interface NarrativeGenerator {
  generateNewsArticle(facts: RecordBrokenFacts): Promise<NewsArticle>;
  generateCoachMessage(facts: CoachMessageFacts): Promise<string>;
  generateInterviewAnswer(facts: InterviewFacts): Promise<string>;
}
