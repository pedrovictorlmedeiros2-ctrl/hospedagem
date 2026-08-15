import { Prisma, type PrismaClient } from "@prisma/client";
import { generateKnockoutBracket } from "../domain/knockoutBracket.js";
import { resolveCupWinner } from "../domain/resolveCupWinner.js";
import type {
  CupFixtureRecord,
  CupRepository,
  CupStageMatchRecord,
  CupStatusRecord,
  GetOrCreateSeasonCupInput,
} from "../ports/cupRepository.js";

/**
 * Spacing between a stage's matches' `scheduledAt` timestamps, used purely
 * to recover deterministic slot order (0v1, 2v3, ...) when pairing winners
 * into the next round — Match has no dedicated "bracket slot" column, and
 * every match in a stage is created together in one batch, so relative
 * `scheduledAt` order is otherwise all that's left to sort by.
 */
const SLOT_SPACING_MS = 1000;

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — no
 * DATABASE_URL was available to run it end-to-end. See docs/ROADMAP.md.
 */
export class PrismaCupRepository implements CupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateSeasonCup(input: GetOrCreateSeasonCupInput): Promise<{ tournamentId: string }> {
    const competition = await this.upsertCompetition(input.competitionName);
    const tournament = await this.upsertTournament(competition.id, input.seasonId);

    // Check-then-generate — same accepted race window documented on
    // CompetitionRepository.getOrCreateSeasonLeague (only matters for the
    // very first concurrent call for a brand-new cup name).
    const existingEntries = await this.prisma.tournamentEntry.count({ where: { tournamentId: tournament.id } });
    if (existingEntries === 0) {
      await this.generateBracket(tournament.id, input.teams);
    }

    return { tournamentId: tournament.id };
  }

  private async upsertCompetition(name: string) {
    try {
      return await this.prisma.competition.upsert({
        where: { name },
        create: { name, type: "CUP" },
        update: {},
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.prisma.competition.findUniqueOrThrow({ where: { name } });
      }
      throw error;
    }
  }

  private async upsertTournament(competitionId: string, seasonId: string) {
    try {
      return await this.prisma.tournament.upsert({
        where: { competitionId_seasonId: { competitionId, seasonId } },
        create: { competitionId, seasonId, status: "IN_PROGRESS" },
        update: {},
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.prisma.tournament.findUniqueOrThrow({ where: { competitionId_seasonId: { competitionId, seasonId } } });
      }
      throw error;
    }
  }

  private async generateBracket(tournamentId: string, teams: GetOrCreateSeasonCupInput["teams"]): Promise<void> {
    await this.prisma.tournamentEntry.createMany({
      data: teams.map((team) => ({ tournamentId, teamId: team.teamId })),
    });

    const bracket = generateKnockoutBracket(teams.map((team) => team.teamId));
    const stages = await Promise.all(
      bracket.map((stage) => this.prisma.tournamentStage.create({ data: { tournamentId, type: stage.type, order: stage.order } })),
    );

    const firstStage = bracket[0];
    const firstStageRow = stages[0];
    if (!firstStage || !firstStageRow) throw new Error("Internal error: generateKnockoutBracket returned no stages");

    const now = Date.now();
    await this.prisma.match.createMany({
      data: firstStage.matches.map((match, slotIndex) => ({
        tournamentId,
        stageId: firstStageRow.id,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        status: "SCHEDULED",
        scheduledAt: new Date(now + slotIndex * SLOT_SPACING_MS),
      })),
    });
  }

  async getNextFixtureForTeam(tournamentId: string, teamId: string): Promise<CupFixtureRecord | null> {
    const match = await this.prisma.match.findFirst({
      where: { tournamentId, status: "SCHEDULED", OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
      include: { homeTeam: true, awayTeam: true, stage: true },
    });
    if (!match || !match.stage) return null;

    return {
      matchId: match.id,
      tournamentId,
      stage: match.stage.type,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeam.name,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeam.name,
    };
  }

  /**
   * The Match row's own score/status is already written by
   * MatchRepository.persistMatchResult before this is called (same
   * convention as CompetitionRepository) — this only handles bracket
   * progression: once every match of the just-finished match's stage is
   * FINISHED, the next stage's fixtures are generated from the winners.
   */
  async recordFixtureResult(tournamentId: string, matchId: string, _homeScore: number, _awayScore: number): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId }, include: { stage: true } });
    if (!match || !match.stageId || !match.stage) return;

    const stageMatches = await this.prisma.match.findMany({
      where: { stageId: match.stageId },
      orderBy: { scheduledAt: "asc" },
    });
    if (!stageMatches.every((row) => row.status === "FINISHED")) return;

    const stages = await this.prisma.tournamentStage.findMany({ where: { tournamentId }, orderBy: { order: "asc" } });
    const currentStageIndex = stages.findIndex((stage) => stage.id === match.stageId);
    const nextStage = stages[currentStageIndex + 1];
    if (!nextStage) return; // that was the FINAL — bracket is complete, champion derived in getStatus

    const winners = stageMatches.map((row) =>
      resolveCupWinner({
        matchId: row.id,
        homeTeamId: row.homeTeamId,
        awayTeamId: row.awayTeamId,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
      }),
    );

    const now = Date.now();
    const nextMatches = [];
    for (let i = 0; i < winners.length; i += 2) {
      const home = winners[i];
      const away = winners[i + 1];
      if (home === undefined || away === undefined) continue;
      nextMatches.push({
        tournamentId,
        stageId: nextStage.id,
        homeTeamId: home,
        awayTeamId: away,
        status: "SCHEDULED" as const,
        scheduledAt: new Date(now + nextMatches.length * SLOT_SPACING_MS),
      });
    }
    await this.prisma.match.createMany({ data: nextMatches });
  }

  async getStatus(tournamentId: string): Promise<CupStatusRecord> {
    const [stages, matches] = await Promise.all([
      this.prisma.tournamentStage.findMany({ where: { tournamentId }, orderBy: { order: "asc" } }),
      this.prisma.match.findMany({ where: { tournamentId }, include: { homeTeam: true, awayTeam: true, stage: true }, orderBy: { scheduledAt: "asc" } }),
    ]);

    const rows: CupStageMatchRecord[] = matches
      .filter((match) => match.stage)
      .map((match) => {
        const decided = match.status === "FINISHED";
        const winnerTeamId = decided
          ? resolveCupWinner({
              matchId: match.id,
              homeTeamId: match.homeTeamId,
              awayTeamId: match.awayTeamId,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
            })
          : null;
        return {
          stage: match.stage!.type,
          homeTeamName: match.homeTeam.name,
          awayTeamName: match.awayTeam.name,
          homeScore: decided ? match.homeScore : null,
          awayScore: decided ? match.awayScore : null,
          winnerTeamName: winnerTeamId ? (winnerTeamId === match.homeTeamId ? match.homeTeam.name : match.awayTeam.name) : null,
        };
      });

    const finalStage = stages[stages.length - 1];
    const finalMatch = finalStage ? matches.find((match) => match.stageId === finalStage.id) : undefined;
    const championTeamName = finalMatch && finalMatch.status === "FINISHED"
      ? rows.find((row) => row.stage === finalStage?.type)?.winnerTeamName ?? null
      : null;

    return { tournamentId, stages: rows, championTeamName };
  }
}
