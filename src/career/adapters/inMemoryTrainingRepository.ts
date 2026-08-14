import type { RecordTrainingInput, TrainingRepository } from "../ports/trainingRepository.js";

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryTrainingRepository implements TrainingRepository {
  private readonly logsByPlayerId = new Map<string, RecordTrainingInput[]>();

  async getLastTrainingAt(playerId: string): Promise<Date | null> {
    const logs = this.logsByPlayerId.get(playerId);
    if (!logs || logs.length === 0) return null;
    return logs.reduce<Date>(
      (latest, log) => (log.performedAt > latest ? log.performedAt : latest),
      new Date(0),
    );
  }

  async recordTraining(input: RecordTrainingInput): Promise<void> {
    const existing = this.logsByPlayerId.get(input.playerId) ?? [];
    existing.push(input);
    this.logsByPlayerId.set(input.playerId, existing);
  }
}
