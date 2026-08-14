import { randomUUID } from "node:crypto";
import { ALL_RECORD_CATEGORIES, type RecordCategory } from "../domain/records.js";
import type { RecordEntry, RecordRepository, SetRecordInput } from "../ports/recordRepository.js";

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryRecordRepository implements RecordRepository {
  private readonly historyByCategory = new Map<RecordCategory, RecordEntry[]>();

  async getCurrentRecord(category: RecordCategory): Promise<RecordEntry | null> {
    const history = this.historyByCategory.get(category) ?? [];
    return history[history.length - 1] ?? null;
  }

  async setRecord(input: SetRecordInput): Promise<RecordEntry> {
    const entry: RecordEntry = {
      id: randomUUID(),
      category: input.category,
      holderPlayerId: input.holderPlayerId,
      value: input.value,
      previousHolderId: input.previousHolderId,
      previousValue: input.previousValue,
      achievedAt: input.achievedAt,
    };
    const history = this.historyByCategory.get(input.category) ?? [];
    history.push(entry);
    this.historyByCategory.set(input.category, history);
    return entry;
  }

  async listCurrentRecords(): Promise<RecordEntry[]> {
    const current: RecordEntry[] = [];
    for (const category of ALL_RECORD_CATEGORIES) {
      const record = await this.getCurrentRecord(category);
      if (record) current.push(record);
    }
    return current;
  }
}
