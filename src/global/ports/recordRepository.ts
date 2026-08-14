import type { RecordCategory } from "../domain/records.js";

export interface RecordEntry {
  id: string;
  category: RecordCategory;
  holderPlayerId: string;
  value: number;
  previousHolderId: string | null;
  previousValue: number | null;
  achievedAt: Date;
}

export interface SetRecordInput {
  category: RecordCategory;
  holderPlayerId: string;
  value: number;
  previousHolderId: string | null;
  previousValue: number | null;
  achievedAt: Date;
}

/**
 * `Record` is append-only in the schema — every broken record creates a
 * new row rather than updating one in place, preserving full history.
 * `getCurrentRecord` reads the most recent row for a category;
 * `setRecord` only ever creates.
 */
export interface RecordRepository {
  getCurrentRecord(category: RecordCategory): Promise<RecordEntry | null>;
  setRecord(input: SetRecordInput): Promise<RecordEntry>;
  /** The current holder for every category that has ever been set. */
  listCurrentRecords(): Promise<RecordEntry[]>;
}
