import { randomUUID } from "node:crypto";
import type { CareerStage } from "@prisma/client";
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

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryCareerRepository implements CareerRepository {
  private readonly seasonsByNumber = new Map<number, SeasonRecord>();
  private readonly clubsByKey = new Map<string, ClubRecord>();
  private readonly clubsById = new Map<string, ClubRecord>();
  private readonly teamsByClubSeason = new Map<string, TeamRecord>();
  private readonly teamsById = new Map<string, TeamRecord>();
  private readonly rosterByTeam = new Map<string, Set<string>>(); // teamId -> active playerIds
  private readonly careersByPlayerId = new Map<string, CareerRecord>();
  private readonly injuriesByPlayerId = new Map<string, RecordInjuryInput[]>();

  async getOrCreateSeason(number: number, _now: Date): Promise<SeasonRecord> {
    const existing = this.seasonsByNumber.get(number);
    if (existing) return existing;

    const season: SeasonRecord = { id: randomUUID(), name: seasonNameFor(number), number };
    this.seasonsByNumber.set(number, season);
    return season;
  }

  async getOrCreateClub(input: GetOrCreateClubInput): Promise<ClubRecord> {
    const existing = this.clubsByKey.get(input.externalKey);
    if (existing) return existing;

    const club: ClubRecord = {
      id: randomUUID(),
      name: input.name,
      country: input.country,
      tier: input.tier,
      reputation: input.reputation,
    };
    this.clubsByKey.set(input.externalKey, club);
    this.clubsById.set(club.id, club);
    return club;
  }

  async getClubById(clubId: string): Promise<ClubRecord> {
    const club = this.clubsById.get(clubId);
    if (!club) {
      throw new Error(`Internal error: no club with id ${clubId}`);
    }
    return club;
  }

  async getClubByTeamId(teamId: string): Promise<ClubRecord | null> {
    const team = this.teamsById.get(teamId);
    if (!team?.clubId) return null;
    return this.clubsById.get(team.clubId) ?? null;
  }

  async getOrCreateTeam(input: GetOrCreateTeamInput): Promise<TeamRecord> {
    const key = `${input.clubId}:${input.seasonId}`;
    const existing = this.teamsByClubSeason.get(key);
    if (existing) return existing;

    const team: TeamRecord = {
      id: randomUUID(),
      name: input.name,
      clubId: input.clubId,
      seasonId: input.seasonId,
    };
    this.teamsByClubSeason.set(key, team);
    this.teamsById.set(team.id, team);
    return team;
  }

  async ensureOnRoster(input: EnsureOnRosterInput): Promise<void> {
    const members = this.rosterByTeam.get(input.teamId) ?? new Set<string>();
    members.add(input.playerId);
    this.rosterByTeam.set(input.teamId, members);
  }

  async leaveRoster(teamId: string, playerId: string, _now: Date): Promise<void> {
    this.rosterByTeam.get(teamId)?.delete(playerId);
  }

  async getCareer(playerId: string): Promise<CareerRecord | null> {
    return this.careersByPlayerId.get(playerId) ?? null;
  }

  async createCareer(input: CreateCareerInput): Promise<CareerRecord> {
    const existing = this.careersByPlayerId.get(input.playerId);
    if (existing) return existing;

    const career: CareerRecord = {
      id: randomUUID(),
      playerId: input.playerId,
      stage: input.stage,
      currentSeasonNumber: 1,
      currentClubId: input.clubId,
      debutAt: input.debutAt,
      isRetired: false,
    };
    this.careersByPlayerId.set(input.playerId, career);
    return career;
  }

  async updateCareerStage(playerId: string, stage: CareerStage): Promise<CareerRecord> {
    const existing = this.careersByPlayerId.get(playerId);
    if (!existing) {
      throw new Error(`Internal error: no career for player ${playerId}`);
    }
    const updated = { ...existing, stage };
    this.careersByPlayerId.set(playerId, updated);
    return updated;
  }

  async updateCareerClub(playerId: string, clubId: string): Promise<CareerRecord> {
    const existing = this.careersByPlayerId.get(playerId);
    if (!existing) {
      throw new Error(`Internal error: no career for player ${playerId}`);
    }
    const updated = { ...existing, currentClubId: clubId };
    this.careersByPlayerId.set(playerId, updated);
    return updated;
  }

  async advanceCareerSeason(playerId: string, seasonNumber: number): Promise<CareerRecord> {
    const existing = this.careersByPlayerId.get(playerId);
    if (!existing) {
      throw new Error(`Internal error: no career for player ${playerId}`);
    }
    const updated = { ...existing, currentSeasonNumber: seasonNumber };
    this.careersByPlayerId.set(playerId, updated);
    return updated;
  }

  async recordInjury(input: RecordInjuryInput): Promise<void> {
    const existing = this.injuriesByPlayerId.get(input.playerId) ?? [];
    existing.push(input);
    this.injuriesByPlayerId.set(input.playerId, existing);
  }

  async hasActiveInjury(playerId: string, now: Date): Promise<boolean> {
    const injuries = this.injuriesByPlayerId.get(playerId) ?? [];
    return injuries.some((injury) => injury.expectedReturnAt.getTime() > now.getTime());
  }
}
