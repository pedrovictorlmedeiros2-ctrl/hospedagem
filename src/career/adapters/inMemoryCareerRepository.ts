import { randomUUID } from "node:crypto";
import type { CareerStage } from "@prisma/client";
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

const ACTIVE_SEASON_NUMBER = 1;

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryCareerRepository implements CareerRepository {
  private season: SeasonRecord | null = null;
  private readonly clubsByKey = new Map<string, ClubRecord>();
  private readonly teamsByClubSeason = new Map<string, TeamRecord>();
  private readonly roster = new Set<string>(); // `${teamId}:${playerId}`
  private readonly careersByPlayerId = new Map<string, CareerRecord>();
  private readonly injuriesByPlayerId = new Map<string, RecordInjuryInput[]>();

  async getOrCreateActiveSeason(): Promise<SeasonRecord> {
    if (!this.season) {
      this.season = {
        id: randomUUID(),
        name: "SEASON 01 — THE BEGINNING",
        number: ACTIVE_SEASON_NUMBER,
      };
    }
    return this.season;
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
    return club;
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
    return team;
  }

  async ensureOnRoster(input: EnsureOnRosterInput): Promise<void> {
    this.roster.add(`${input.teamId}:${input.playerId}`);
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
