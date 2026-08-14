export interface NewsRecord {
  id: string;
  headline: string;
  body: string;
  /** Structured facts the narrative was generated from — kept alongside the prose for audit/regeneration. */
  facts: Record<string, unknown>;
  generatedByAi: boolean;
  publishedAt: Date;
}

export interface PublishNewsInput {
  headline: string;
  body: string;
  facts: Record<string, unknown>;
  generatedByAi: boolean;
  publishedAt: Date;
}

export interface NewsRepository {
  publish(input: PublishNewsInput): Promise<NewsRecord>;
  /** Most recent first. */
  listRecent(limit: number): Promise<NewsRecord[]>;
}
