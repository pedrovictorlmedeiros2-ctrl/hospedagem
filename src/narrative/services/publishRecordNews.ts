import type { RecordCategory } from "../../global/domain/records.js";
import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import type { Logger } from "../../shared/logger.js";
import type { RecordBrokenFacts } from "../domain/narrativeFacts.js";
import type { NarrativeGenerator } from "../ports/narrativeGenerator.js";
import type { NewsRepository } from "../ports/newsRepository.js";

export interface PublishRecordNewsDeps {
  narrativeGenerator: NarrativeGenerator;
  newsRepository: NewsRepository;
  playerRepository: PlayerRepository;
  logger: Logger;
}

export interface PublishRecordNewsInput {
  category: RecordCategory;
  playerId: string;
  previousHolderId: string | null;
  previousValue: number | null;
  value: number;
  now: Date;
}

export interface PublishedRecordArticle {
  headline: string;
  body: string;
}

/**
 * Turns a broken world record into a published News article. Meant to run
 * as the RECORD_BROKEN event handler (see src/index.ts) — never awaited by
 * the match/duel flow that emitted the event, so an LLM hiccup here can
 * never delay or fail gameplay (see ADR 0001, adenda Fase 10).
 *
 * Returns the published headline/body (or null when skipped) so the caller
 * can also relay the same article elsewhere — e.g. notifyGuildEvent posting
 * it to configured Discord channels — without generating it twice.
 */
export async function publishRecordNews(
  deps: PublishRecordNewsDeps,
  input: PublishRecordNewsInput,
): Promise<PublishedRecordArticle | null> {
  const holder = await deps.playerRepository.findById(input.playerId);
  if (!holder) {
    deps.logger.warn({ playerId: input.playerId }, "publishRecordNews: holder player not found, skipping");
    return null;
  }
  const previousHolder = input.previousHolderId ? await deps.playerRepository.findById(input.previousHolderId) : null;

  const facts: RecordBrokenFacts = {
    kind: "RECORD_BROKEN",
    category: input.category,
    holderNickname: holder.nickname,
    value: input.value,
    previousHolderNickname: previousHolder?.nickname ?? null,
    previousValue: input.previousValue,
  };

  const article = await deps.narrativeGenerator.generateNewsArticle(facts);
  await deps.newsRepository.publish({
    headline: article.headline,
    body: article.body,
    facts: facts as unknown as Record<string, unknown>,
    generatedByAi: article.generatedByAi,
    publishedAt: input.now,
  });

  return { headline: article.headline, body: article.body };
}
