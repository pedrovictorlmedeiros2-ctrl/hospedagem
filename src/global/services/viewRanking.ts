import type { PlayerRepository, RankingMetric } from "../../player/ports/playerRepository.js";

export interface ViewRankingDeps {
  playerRepository: PlayerRepository;
}

export interface ViewRankingInput {
  metric: RankingMetric;
  limit?: number;
}

export interface RankingRow {
  rank: number;
  nickname: string;
  value: number;
}

export interface ViewRankingOutput {
  metric: RankingMetric;
  rows: RankingRow[];
}

const DEFAULT_LIMIT = 10;

export async function viewRanking(deps: ViewRankingDeps, input: ViewRankingInput): Promise<ViewRankingOutput> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const players = await deps.playerRepository.listTopPlayers(input.metric, limit);

  const rows: RankingRow[] = players.map((player, index) => ({
    rank: index + 1,
    nickname: player.nickname,
    value: input.metric === "GLOBAL_RATING" ? player.globalRating : player.overall,
  }));

  return { metric: input.metric, rows };
}
