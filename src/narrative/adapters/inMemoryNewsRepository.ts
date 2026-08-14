import { randomUUID } from "node:crypto";
import type { NewsRecord, NewsRepository, PublishNewsInput } from "../ports/newsRepository.js";

/**
 * In-memory adapter — used by unit/service tests and local iteration
 * without a real Postgres instance. NOT wired into the running bot; see
 * PrismaNewsRepository for the production implementation.
 */
export class InMemoryNewsRepository implements NewsRepository {
  private readonly all: NewsRecord[] = [];

  async publish(input: PublishNewsInput): Promise<NewsRecord> {
    const record: NewsRecord = { id: randomUUID(), ...input };
    this.all.push(record);
    return record;
  }

  async listRecent(limit: number): Promise<NewsRecord[]> {
    return [...this.all].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, limit);
  }
}
