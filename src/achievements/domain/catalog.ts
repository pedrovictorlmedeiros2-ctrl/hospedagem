/**
 * Fixed, shared catalog — same "shared world" get-or-create-by-key
 * pattern as cards/domain/catalog.ts and career/domain/clubNaming.ts.
 * Every trigger keys off data a caller ALREADY has at hand after an
 * existing service call completes (a match result, a duel outcome, a
 * pack opening) — no new event instrumentation was needed to add these.
 */
export type AchievementKey = "FIRST_MATCH" | "FIRST_WIN" | "FIRST_GOAL" | "WORLD_RECORD" | "DUEL_WINNER" | "FIRST_PACK";

export interface AchievementDefinition {
  key: AchievementKey;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { key: "FIRST_MATCH", name: "Estreante", description: "Jogue sua primeira partida de carreira." },
  { key: "FIRST_WIN", name: "Primeira Vitória", description: "Vença sua primeira partida de carreira." },
  { key: "FIRST_GOAL", name: "Artilheiro", description: "Marque seu primeiro gol numa partida de carreira." },
  { key: "WORLD_RECORD", name: "Recordista Mundial", description: "Quebre um recorde mundial." },
  { key: "DUEL_WINNER", name: "Duelista", description: "Vença um duelo 1x1 contra outro jogador." },
  { key: "FIRST_PACK", name: "Colecionador", description: "Abra seu primeiro pacote de cartas." },
];
