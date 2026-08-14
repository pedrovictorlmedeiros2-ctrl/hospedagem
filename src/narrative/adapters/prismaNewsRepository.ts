import { Prisma, type PrismaClient } from "@prisma/client";
import type { NewsRecord, NewsRepository, PublishNewsInput } from "../ports/newsRepository.js";

type NewsRow = Awaited<ReturnType<PrismaClient["news"]["create"]>>;

function toDomain(row: NewsRow): NewsRecord {
  return {
    id: row.id,
    headline: row.headline,
    body: row.body,
    facts: row.facts as Record<string, unknown>,
    generatedByAi: row.generatedByAi,
    publishedAt: row.publishedAt,
  };
}

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — no
 * DATABASE_URL was available to run it end-to-end. See docs/ROADMAP.md.
 */
export class PrismaNewsRepository implements NewsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async publish(input: PublishNewsInput): Promise<NewsRecord> {
    const row = await this.prisma.news.create({
      data: {
        headline: input.headline,
        body: input.body,
        facts: input.facts as Prisma.InputJsonValue,
        generatedByAi: input.generatedByAi,
        publishedAt: input.publishedAt,
      },
    });
    return toDomain(row);
  }

  async listRecent(limit: number): Promise<NewsRecord[]> {
    const rows = await this.prisma.news.findMany({ orderBy: { publishedAt: "desc" }, take: limit });
    return rows.map(toDomain);
  }
}
