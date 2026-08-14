export interface RecordTrainingInput {
  playerId: string;
  focus: string;
  gainedAttributePoints: number;
  staminaCost: number;
  performedAt: Date;
}

export interface TrainingRepository {
  getLastTrainingAt(playerId: string): Promise<Date | null>;
  recordTraining(input: RecordTrainingInput): Promise<void>;
}
