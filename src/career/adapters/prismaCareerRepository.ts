import { Prisma, type CareerStage, type PrismaClient } from "@prisma/client";
import { seasonNameFor } from "../domain/season.js";
import type {
  CareerRecord,
  CareerRepository,
  ClubRecord,
  CreateCareerInput,
  EnsureOnRosterInput,
  GetOrCreateClubInput,
  GetOrCreateTeamInput,
  RecordInjuryInput,
  SeasonRecord,
  TeamRecord,
} from "../ports/careerRepository.js";

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaCareerRepository implements CareerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateSeason(number: number, now: Date): Promise<SeasonRecord> {
    const season = await this.prisma.season.upsert({
      where: { number },
      create: {
        name: seasonNameFor(number),
        number,
        startsAt: now,
        isActive: true,
      },
      update: {},
    });
    return { id: season.id, name: season.name, number: season.number };
  }

  async getOrCreateClub(input: GetOrCreateClubInput): Promise<ClubRecord> {
    try {
      const club = await this.prisma.club.upsert({
        where: { externalKey: input.externalKey },
        create: {
          externalKey: input.externalKey,
          name: input.name,
          country: input.country,
          tier: input.tier,
          reputation: input.reputation,
        },
        update: {},
      });
      return {
        id: club.id,
        name: club.name,
        country: club.country,
        tier: club.tier,
        reputation: club.reputation,
      };
    } catch (error) {
      // Same upsert race as PrismaUserRepository.ensureUserForDiscordId — see that file's comment.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const club = await this.prisma.club.findUniqueOrThrow({
          where: { externalKey: input.externalKey },
        });
        return {
          id: club.id,
          name: club.name,
          country: club.country,
          tier: club.tier,
          reputation: club.reputation,
        };
      }
      throw error;
    }
  }

  async getClubById(clubId: string): Promise<ClubRecord> {
    const club = await this.prisma.club.findUniqueOrThrow({ where: { id: clubId } });
    return {
      id: club.id,
      name: club.name,
      country: club.country,
      tier: club.tier,
      reputation: club.reputation,
    };
  }

  async getClubByTeamId(teamId: string): Promise<ClubRecord | null> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, include: { club: true } });
    if (!team?.club) return null;
    return {
      id: team.club.id,
      name: team.club.name,
      country: team.club.country,
      tier: team.club.tier,
      reputation: team.club.reputation,
    };
  }

  async getOrCreateTeam(input: GetOrCreateTeamInput): Promise<TeamRecord> {
    try {
      const team = await this.prisma.team.upsert({
        where: { clubId_seasonId: { clubId: input.clubId, seasonId: input.seasonId } },
        create: { kind: "CLUB", name: input.name, clubId: input.clubId, seasonId: input.seasonId },
        update: {},
      });
      return { id: team.id, name: team.name, clubId: team.clubId, seasonId: team.seasonId };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const team = await this.prisma.team.findUniqueOrThrow({
          where: { clubId_seasonId: { clubId: input.clubId, seasonId: input.seasonId } },
        });
        return { id: team.id, name: team.name, clubId: team.clubId, seasonId: team.seasonId };
      }
      throw error;
    }
  }

  async ensureOnRoster(input: EnsureOnRosterInput): Promise<void> {
    const existing = await this.prisma.teamPlayer.findFirst({
      where: { teamId: input.teamId, playerId: input.playerId, leftAt: null },
    });
    if (existing) return;

    // Not race-proof under true concurrent first-join (TeamPlayer's unique
    // key includes joinedAt, so it can't back a clean upsert here) — a
    // duplicate roster row in that narrow window is a cosmetic risk, not a
    // data-integrity one. See docs/RISK_REGISTER.md.
    await this.prisma.teamPlayer.create({
      data: { teamId: input.teamId, playerId: input.playerId, squadNumber: input.squadNumber },
    });
  }

  async leaveRoster(teamId: string, playerId: string, now: Date): Promise<void> {
    // updateMany, not update: the unique key on TeamPlayer includes
    // joinedAt, so there's no single natural `where` for "the" active row
    // — this closes out whichever row(s) are currently open (leftAt:
    // null) for this player on this team, which is always exactly one in
    // practice (ensureOnRoster never creates a second while one is open).
    await this.prisma.teamPlayer.updateMany({
      where: { teamId, playerId, leftAt: null },
      data: { leftAt: now },
    });
  }

  async getCareer(playerId: string): Promise<CareerRecord | null> {
    const career = await this.prisma.career.findUnique({ where: { playerId } });
    return career ? this.toDomain(career) : null;
  }

  async createCareer(input: CreateCareerInput): Promise<CareerRecord> {
    try {
      const career = await this.prisma.career.upsert({
        where: { playerId: input.playerId },
        create: {
          playerId: input.playerId,
          currentClubId: input.clubId,
          stage: input.stage,
          debutAt: input.debutAt,
        },
        update: {},
      });
      return this.toDomain(career);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const career = await this.prisma.career.findUniqueOrThrow({
          where: { playerId: input.playerId },
        });
        return this.toDomain(career);
      }
      throw error;
    }
  }

  async updateCareerStage(playerId: string, stage: CareerStage): Promise<CareerRecord> {
    const career = await this.prisma.career.update({ where: { playerId }, data: { stage } });
    return this.toDomain(career);
  }

  async updateCareerClub(playerId: string, clubId: string): Promise<CareerRecord> {
    const career = await this.prisma.career.update({ where: { playerId }, data: { currentClubId: clubId } });
    return this.toDomain(career);
  }

  async advanceCareerSeason(playerId: string, seasonNumber: number): Promise<CareerRecord> {
    const career = await this.prisma.career.update({ where: { playerId }, data: { currentSeasonNumber: seasonNumber } });
    return this.toDomain(career);
  }

  async recordInjury(input: RecordInjuryInput): Promise<void> {
    await this.prisma.injury.create({
      data: {
        playerId: input.playerId,
        severity: input.severity,
        diagnosis: input.diagnosis,
        occurredAt: input.occurredAt,
        expectedReturnAt: input.expectedReturnAt,
      },
    });
  }

  async hasActiveInjury(playerId: string, now: Date): Promise<boolean> {
    const injury = await this.prisma.injury.findFirst({
      where: { playerId, recoveredAt: null, expectedReturnAt: { gt: now } },
    });
    return injury !== null;
  }

  private toDomain(career: {
    id: string;
    playerId: string;
    stage: CareerStage;
    currentSeasonNumber: number;
    currentClubId: string | null;
    debutAt: Date | null;
    isRetired: boolean;
  }): CareerRecord {
    return {
      id: career.id,
      playerId: career.playerId,
      stage: career.stage,
      currentSeasonNumber: career.currentSeasonNumber,
      currentClubId: career.currentClubId,
      debutAt: career.debutAt,
      isRetired: career.isRetired,
    };
  }
}
