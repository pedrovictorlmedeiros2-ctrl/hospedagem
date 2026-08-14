import { isNewRecord, type RecordCategory } from "../domain/records.js";
import type { RecordEntry, RecordRepository } from "../ports/recordRepository.js";

export interface CheckAndUpdateRecordDeps {
  recordRepository: RecordRepository;
}

export interface CheckAndUpdateRecordInput {
  category: RecordCategory;
  playerId: string;
  value: number;
  now: Date;
}

export interface CheckAndUpdateRecordOutput {
  isNewRecord: boolean;
  record: RecordEntry;
}

/**
 * Checks a candidate value against the current world record for a
 * category and, if it's a genuine improvement, appends a new `Record`
 * row (see global/ports/recordRepository.ts — this never updates a row
 * in place). Check-then-act against the current holder, not wrapped in a
 * DB transaction — the same low-severity, documented race already
 * accepted for `getOrCreateSeasonLeague`'s calendar generation: a truly
 * simultaneous double-break of the same record is rare, and the worst
 * case is a harmless duplicate history row, not corrupted state.
 */
export async function checkAndUpdateRecord(
  deps: CheckAndUpdateRecordDeps,
  input: CheckAndUpdateRecordInput,
): Promise<CheckAndUpdateRecordOutput> {
  const current = await deps.recordRepository.getCurrentRecord(input.category);

  if (current && !isNewRecord(current, input.value)) {
    return { isNewRecord: false, record: current };
  }

  const record = await deps.recordRepository.setRecord({
    category: input.category,
    holderPlayerId: input.playerId,
    value: input.value,
    previousHolderId: current?.holderPlayerId ?? null,
    previousValue: current?.value ?? null,
    achievedAt: input.now,
  });

  return { isNewRecord: true, record };
}
