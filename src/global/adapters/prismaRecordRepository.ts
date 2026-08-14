import type { PrismaClient } from "@prisma/client";
import { ALL_RECORD_CATEGORIES, type RecordCategory } from "../domain/records.js";
import type { RecordEntry, RecordRepository, SetRecordInput } from "../ports/recordRepository.js";

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaRecordRepository implements RecordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getCurrentRecord(category: RecordCategory): Promise<RecordEntry | null> {
    const row = await this.prisma.record.findFirst({
      where: { category },
      orderBy: { achievedAt: "desc" },
    });
    return row ? this.toDomain(row) : null;
  }

  async setRecord(input: SetRecordInput): Promise<RecordEntry> {
    const row = await this.prisma.record.create({
      data: {
        category: input.category,
        holderPlayerId: input.holderPlayerId,
        value: input.value,
        previousHolderId: input.previousHolderId,
        previousValue: input.previousValue,
        achievedAt: input.achievedAt,
      },
    });
    return this.toDomain(row);
  }

  async listCurrentRecords(): Promise<RecordEntry[]> {
    const records: RecordEntry[] = [];
    for (const category of ALL_RECORD_CATEGORIES) {
      const record = await this.getCurrentRecord(category);
      if (record) records.push(record);
    }
    return records;
  }

  private toDomain(row: {
    id: string;
    category: string;
    holderPlayerId: string;
    value: number;
    previousHolderId: string | null;
    previousValue: number | null;
    achievedAt: Date;
  }): RecordEntry {
    return {
      id: row.id,
      category: row.category as RecordCategory,
      holderPlayerId: row.holderPlayerId,
      value: row.value,
      previousHolderId: row.previousHolderId,
      previousValue: row.previousValue,
      achievedAt: row.achievedAt,
    };
  }
}
