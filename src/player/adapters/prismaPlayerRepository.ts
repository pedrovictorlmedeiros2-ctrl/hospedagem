import { Prisma, type PrismaClient } from "@prisma/client";
import { DuplicateProfileError, ProfileNotFoundError } from "../domain/errors.js";
import type {
  NewPlayerRecord,
  PlayerAttributesPatch,
  PlayerProfilePatch,
  PlayerRecord,
  PlayerRepository,
} from "../ports/playerRepository.js";

type PlayerRow = Awaited<ReturnType<PrismaClient["player"]["create"]>>;

// Explicit field-by-field mapping (rather than a spread) so a future
// Prisma schema change can't silently change the domain contract without
// a compile error here.
function toDomain(row: PlayerRow): PlayerRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    nickname: row.nickname,
    nationality: row.nationality,
    birthDate: row.birthDate,
    position: row.position,
    preferredFoot: row.preferredFoot,
    heightCm: row.heightCm,
    playStyle: row.playStyle,
    shirtNumber: row.shirtNumber,
    bio: row.bio,
    celebration: row.celebration,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    theme: row.theme,
    cardStyle: row.cardStyle,
    profileFrame: row.profileFrame,
    profileBackground: row.profileBackground,
    pace: row.pace,
    shooting: row.shooting,
    passing: row.passing,
    dribbling: row.dribbling,
    defending: row.defending,
    physical: row.physical,
    gkReflexes: row.gkReflexes,
    gkPositioning: row.gkPositioning,
    gkHandling: row.gkHandling,
    gkAerial: row.gkAerial,
    gkOneOnOne: row.gkOneOnOne,
    gkPenalties: row.gkPenalties,
    overall: row.overall,
    form: row.form,
    globalRating: row.globalRating,
    stamina: row.stamina,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — no
 * DATABASE_URL was available to run it end-to-end (no `prisma migrate
 * dev`, no actual insert/update round trip). See docs/ROADMAP.md.
 */
export class PrismaPlayerRepository implements PlayerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewPlayerRecord): Promise<PlayerRecord> {
    try {
      const row = await this.prisma.player.create({ data: input });
      return toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new DuplicateProfileError(input.userId);
      }
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<PlayerRecord | null> {
    const row = await this.prisma.player.findUnique({ where: { userId } });
    return row ? toDomain(row) : null;
  }

  async update(userId: string, patch: PlayerProfilePatch): Promise<PlayerRecord> {
    try {
      const row = await this.prisma.player.update({ where: { userId }, data: patch });
      return toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new ProfileNotFoundError();
      }
      throw error;
    }
  }

  async updateAttributes(userId: string, patch: PlayerAttributesPatch): Promise<PlayerRecord> {
    try {
      const row = await this.prisma.player.update({ where: { userId }, data: patch });
      return toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new ProfileNotFoundError();
      }
      throw error;
    }
  }
}
