import type { MatchEventType, Prisma, PrismaClient } from "@prisma/client";
import type { SimMatchEventType } from "../domain/types.js";
import type {
  MatchRepository,
  PersistedMatch,
  PersistedSeasonStat,
  PersistMatchResultInput,
} from "../ports/matchRepository.js";

/** KICKOFF/HALFTIME/FULLTIME are presentation-only in the engine's event log — the schema's MatchEventType has no equivalent, so these are simply not persisted as rows. */
export function toPrismaEventType(type: SimMatchEventType): MatchEventType | null {
  switch (type) {
    case "GOAL":
      return "GOAL";
    case "OWN_GOAL":
      return "OWN_GOAL";
    case "YELLOW_CARD":
      return "YELLOW_CARD";
    case "RED_CARD":
      return "RED_CARD";
    case "SUBSTITUTION":
      return "SUBSTITUTION";
    case "INJURY":
      return "INJURY";
    case "PENALTY_SCORED":
      return "PENALTY_SCORED";
    case "PENALTY_MISSED":
      return "PENALTY_MISSED";
    case "CORNER":
      return "CORNER";
    case "OFFSIDE":
      return "OFFSIDE";
    case "KICKOFF":
    case "HALFTIME":
    case "FULLTIME":
      return null;
  }
}

/**
 * Real, Postgres-backed implementation. Implemented and typechecked but
 * NOT validated against a live database in this environment — see
 * docs/ROADMAP.md.
 */
export class PrismaMatchRepository implements MatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async persistMatchResult(input: PersistMatchResultInput): Promise<PersistedMatch> {
    const { result, realPlayer } = input;
    const realStat = result.playerStats.find(
      (stat) => stat.playerId === realPlayer.matchPlayerInputId,
    );
    if (!realStat) {
      throw new Error(
        `Internal error: no stat line found for the real player (matchPlayerInputId=${realPlayer.matchPlayerInputId})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const matchData = {
        homeTeamId: input.homeTeamId,
        awayTeamId: input.awayTeamId,
        status: "FINISHED" as const,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        scheduledAt: input.scheduledAt,
        startedAt: input.scheduledAt,
        finishedAt: input.scheduledAt,
        simulationSeed: result.seed,
      };

      const match = input.existingMatchId
        ? await tx.match.update({ where: { id: input.existingMatchId }, data: matchData })
        : await tx.match.create({ data: matchData });

      const eventRows = result.events
        .map((event) => {
          const type = toPrismaEventType(event.type);
          if (!type) return null;
          return {
            matchId: match.id,
            minute: event.minute,
            type,
            playerId: event.playerId === realPlayer.matchPlayerInputId ? realPlayer.playerId : null,
            ...(event.metadata ? { metadata: event.metadata as Prisma.InputJsonValue } : {}),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (eventRows.length > 0) {
        await tx.matchEvent.createMany({ data: eventRows });
      }

      await tx.matchPlayerStat.create({
        data: {
          matchId: match.id,
          playerId: realPlayer.playerId,
          minutesPlayed: realStat.minutesPlayed,
          goals: realStat.goals,
          assists: realStat.assists,
          shots: realStat.shots,
          passesCompleted: realStat.passesCompleted,
          tackles: realStat.tackles,
          interceptions: realStat.interceptions,
          saves: realStat.saves,
          goalsConceded: realStat.goalsConceded,
          rating: realStat.rating,
        },
      });

      const existingSeasonStat = await tx.playerSeasonStat.findUnique({
        where: { playerId_seasonId: { playerId: realPlayer.playerId, seasonId: input.seasonId } },
      });

      const seasonStat = existingSeasonStat
        ? await tx.playerSeasonStat.update({
            where: { id: existingSeasonStat.id },
            data: {
              matches: existingSeasonStat.matches + 1,
              goals: existingSeasonStat.goals + realStat.goals,
              assists: existingSeasonStat.assists + realStat.assists,
              avgRating:
                (existingSeasonStat.avgRating * existingSeasonStat.matches + realStat.rating) /
                (existingSeasonStat.matches + 1),
            },
          })
        : await tx.playerSeasonStat.create({
            data: {
              playerId: realPlayer.playerId,
              seasonId: input.seasonId,
              matches: 1,
              goals: realStat.goals,
              assists: realStat.assists,
              avgRating: realStat.rating,
            },
          });

      return {
        matchId: match.id,
        seasonStat: {
          matches: seasonStat.matches,
          goals: seasonStat.goals,
          assists: seasonStat.assists,
          avgRating: seasonStat.avgRating,
        },
      };
    });
  }

  async getPlayerSeasonStat(
    playerId: string,
    seasonId: string,
  ): Promise<PersistedSeasonStat | null> {
    const stat = await this.prisma.playerSeasonStat.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });
    return stat
      ? {
          matches: stat.matches,
          goals: stat.goals,
          assists: stat.assists,
          avgRating: stat.avgRating,
        }
      : null;
  }
}
