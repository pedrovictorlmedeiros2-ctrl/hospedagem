import { Prisma, type PrismaClient } from "@prisma/client";
import { generateRoundRobinFixtures } from "../domain/fixtures.js";
import { computeStandings } from "../domain/standings.js";
import type {
  CompetitionRepository,
  FixtureRecord,
  GetOrCreateSeasonLeagueInput,
  StandingRowRecord,
} from "../ports/competitionRepository.js";

const ROUND_SPACING_DAYS = 7;

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaCompetitionRepository implements CompetitionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateSeasonLeague(input: GetOrCreateSeasonLeagueInput): Promise<{ tournamentId: string }> {
    const competition = await this.upsertCompetition(input.competitionName);
    const tournament = await this.upsertTournament(competition.id, input.seasonId);

    // Check-then-generate — see docs/RISK_REGISTER.md for the accepted
    // race window (only matters for the very first concurrent call for a
    // brand-new competition name).
    const existingEntries = await this.prisma.tournamentEntry.count({ where: { tournamentId: tournament.id } });
    if (existingEntries === 0) {
      await this.generateLeagueCalendar(tournament.id, input.teams);
    }

    return { tournamentId: tournament.id };
  }

  private async upsertCompetition(name: string) {
    try {
      return await this.prisma.competition.upsert({
        where: { name },
        create: { name, type: "LEAGUE" },
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

  private async generateLeagueCalendar(tournamentId: string, teams: GetOrCreateSeasonLeagueInput["teams"]): Promise<void> {
    await this.prisma.tournamentEntry.createMany({
      data: teams.map((team) => ({ tournamentId, teamId: team.teamId })),
    });

    const schedule = generateRoundRobinFixtures(
      teams.map((team) => team.teamId),
      { doubleRound: true },
    );
    const now = Date.now();

    await this.prisma.match.createMany({
      data: schedule.map((fixture) => ({
        tournamentId,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        status: "SCHEDULED",
        scheduledAt: new Date(now + fixture.round * ROUND_SPACING_DAYS * 24 * 60 * 60 * 1000),
      })),
    });
  }

  async getNextFixtureForTeam(tournamentId: string, teamId: string): Promise<FixtureRecord | null> {
    const match = await this.prisma.match.findFirst({
      where: { tournamentId, status: "SCHEDULED", OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
      orderBy: { scheduledAt: "asc" },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) return null;

    return {
      matchId: match.id,
      tournamentId,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeam.name,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeam.name,
    };
  }

  async recordFixtureResult(): Promise<void> {
    // No-op: MatchRepository.persistMatchResult already updated this
    // Match row's status to FINISHED, and getNextFixtureForTeam/
    // getStandings both query live Match rows — there is nothing else to
    // update. The method still exists on the port because the in-memory
    // adapter (a separate, disconnected store in tests) genuinely needs
    // an explicit signal — see the port's doc comment.
  }

  async getStandings(tournamentId: string): Promise<StandingRowRecord[]> {
    const [entries, finishedMatches] = await Promise.all([
      this.prisma.tournamentEntry.findMany({ where: { tournamentId }, include: { team: true } }),
      this.prisma.match.findMany({ where: { tournamentId, status: "FINISHED" } }),
    ]);

    const teamIds = entries.map((entry) => entry.teamId);
    const rows = computeStandings(
      teamIds,
      finishedMatches.map((match) => ({
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      })),
    );

    const teamNameById = new Map(entries.map((entry) => [entry.teamId, entry.team.name]));
    return rows.map((row) => ({ ...row, teamName: teamNameById.get(row.teamId) ?? row.teamId }));
  }
}
