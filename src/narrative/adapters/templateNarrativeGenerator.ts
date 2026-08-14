import type { CoachMessageFacts, InterviewFacts, RecordBrokenFacts } from "../domain/narrativeFacts.js";
import { templateCoachMessage, templateInterviewAnswer, templateNewsArticle } from "../domain/templates.js";
import type { NarrativeGenerator, NewsArticle } from "../ports/narrativeGenerator.js";

/**
 * Deterministic adapter — no I/O, cannot fail, cannot be slow. Used
 * directly when GROQ_API_KEY isn't configured, and as the fallback target
 * of FallbackNarrativeGenerator when it is.
 */
export class TemplateNarrativeGenerator implements NarrativeGenerator {
  async generateNewsArticle(facts: RecordBrokenFacts): Promise<NewsArticle> {
    const { headline, body } = templateNewsArticle(facts);
    return { headline, body, generatedByAi: false };
  }

  async generateCoachMessage(facts: CoachMessageFacts): Promise<string> {
    return templateCoachMessage(facts);
  }

  async generateInterviewAnswer(facts: InterviewFacts): Promise<string> {
    return templateInterviewAnswer(facts);
  }
}
