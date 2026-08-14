import type { NewsRecord, NewsRepository } from "../ports/newsRepository.js";

export interface ViewNewsDeps {
  newsRepository: NewsRepository;
}

export interface ViewNewsInput {
  limit?: number;
}

export interface ViewNewsOutput {
  rows: NewsRecord[];
}

const DEFAULT_LIMIT = 5;

export async function viewNews(deps: ViewNewsDeps, input: ViewNewsInput = {}): Promise<ViewNewsOutput> {
  const rows = await deps.newsRepository.listRecent(input.limit ?? DEFAULT_LIMIT);
  return { rows };
}
