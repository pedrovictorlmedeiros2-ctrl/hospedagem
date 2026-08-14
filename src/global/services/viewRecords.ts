import type { PlayerRepository } from "../../player/ports/playerRepository.js";
import { ALL_RECORD_CATEGORIES, type RecordCategory } from "../domain/records.js";
import type { RecordRepository } from "../ports/recordRepository.js";

export interface ViewRecordsDeps {
  recordRepository: RecordRepository;
  playerRepository: PlayerRepository;
}

export interface RecordRow {
  category: RecordCategory;
  holderNickname: string;
  value: number;
  achievedAt: Date;
}

export interface ViewRecordsOutput {
  rows: RecordRow[];
}

export async function viewRecords(deps: ViewRecordsDeps): Promise<ViewRecordsOutput> {
  const entries = await deps.recordRepository.listCurrentRecords();
  const byCategory = new Map(entries.map((entry) => [entry.category, entry]));

  const rows: RecordRow[] = [];
  for (const category of ALL_RECORD_CATEGORIES) {
    const entry = byCategory.get(category);
    if (!entry) continue;
    const holder = await deps.playerRepository.findById(entry.holderPlayerId);
    rows.push({
      category,
      holderNickname: holder?.nickname ?? "Jogador desconhecido",
      value: entry.value,
      achievedAt: entry.achievedAt,
    });
  }

  return { rows };
}
