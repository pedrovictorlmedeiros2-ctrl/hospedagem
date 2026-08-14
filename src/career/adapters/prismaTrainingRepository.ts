import type { PrismaClient } from "@prisma/client";
import type { RecordTrainingInput, TrainingRepository } from "../ports/trainingRepository.js";

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaTrainingRepository implements TrainingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getLastTrainingAt(playerId: string): Promise<Date | null> {
    const log = await this.prisma.trainingLog.findFirst({
      where: { playerId },
      orderBy: { performedAt: "desc" },
    });
    return log?.performedAt ?? null;
  }

  async recordTraining(input: RecordTrainingInput): Promise<void> {
    await this.prisma.trainingLog.create({
      data: {
        playerId: input.playerId,
        focus: input.focus,
        gainedAttributePoints: input.gainedAttributePoints,
        staminaCost: input.staminaCost,
        performedAt: input.performedAt,
      },
    });
  }
}
