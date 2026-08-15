import { randomUUID } from "node:crypto";
import type { StageType } from "@prisma/client";
import { generateKnockoutBracket } from "../domain/knockoutBracket.js";
import { resolveCupWinner } from "../domain/resolveCupWinner.js";
import type {
  CupFixtureRecord,
  CupRepository,
  CupStatusRecord,
  GetOrCreateSeasonCupInput,
} from "../ports/cupRepository.js";

interface InternalCupMatch {
  matchId: string;
  stage: StageType;
  /** Position within its stage's match list — even index is the "top half" of the pairing that feeds slot `slotIndex/2` of the next round. */
  slotIndex: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

interface CupState {
  teamNameById: Map<string, string>;
  stageTypes: StageType[];
  matchesByStage: Map<StageType, InternalCupMatch[]>;
}

/** In-memory adapter for tests and local iteration without a real Postgres instance. NOT wired into the running bot. */
export class InMemoryCupRepository implements CupRepository {
  private readonly tournamentIdByCupAndSeason = new Map<string, string>();
  private readonly cups = new Map<string, CupState>();

  async getOrCreateSeasonCup(input: GetOrCreateSeasonCupInput): Promise<{ tournamentId: string }> {
    const key = `${input.competitionName}:${input.seasonId}`;
    const existing = this.tournamentIdByCupAndSeason.get(key);
    if (existing) return { tournamentId: existing };

    const tournamentId = randomUUID();
    this.tournamentIdByCupAndSeason.set(key, tournamentId);

    const bracket = generateKnockoutBracket(input.teams.map((team) => team.teamId));
    const firstStage = bracket[0];
    if (!firstStage) throw new Error("Internal error: generateKnockoutBracket returned no stages");

    const matchesByStage = new Map<StageType, InternalCupMatch[]>();
    matchesByStage.set(
      firstStage.type,
      firstStage.matches.map((match, slotIndex) => ({
        matchId: randomUUID(),
        stage: firstStage.type,
        slotIndex,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeScore: null,
        awayScore: null,
      })),
    );

    this.cups.set(tournamentId, {
      teamNameById: new Map(input.teams.map((team) => [team.teamId, team.teamName])),
      stageTypes: bracket.map((stage) => stage.type),
      matchesByStage,
    });

    return { tournamentId };
  }

  async getNextFixtureForTeam(tournamentId: string, teamId: string): Promise<CupFixtureRecord | null> {
    const state = this.cups.get(tournamentId);
    if (!state) return null;

    for (const matches of state.matchesByStage.values()) {
      const match = matches.find(
        (candidate) =>
          candidate.homeScore === null &&
          (candidate.homeTeamId === teamId || candidate.awayTeamId === teamId),
      );
      if (match) {
        return {
          matchId: match.matchId,
          tournamentId,
          stage: match.stage,
          homeTeamId: match.homeTeamId,
          homeTeamName: state.teamNameById.get(match.homeTeamId) ?? match.homeTeamId,
          awayTeamId: match.awayTeamId,
          awayTeamName: state.teamNameById.get(match.awayTeamId) ?? match.awayTeamId,
        };
      }
    }
    return null;
  }

  async recordFixtureResult(tournamentId: string, matchId: string, homeScore: number, awayScore: number): Promise<void> {
    const state = this.cups.get(tournamentId);
    if (!state) return;

    let target: InternalCupMatch | undefined;
    for (const matches of state.matchesByStage.values()) {
      target = matches.find((candidate) => candidate.matchId === matchId);
      if (target) break;
    }
    if (!target || target.homeScore !== null) return; // unknown or already-recorded match — idempotent no-op

    target.homeScore = homeScore;
    target.awayScore = awayScore;

    const stageMatches = state.matchesByStage.get(target.stage) ?? [];
    const stageComplete = stageMatches.every((match) => match.homeScore !== null);
    if (!stageComplete) return;

    const stageIndex = state.stageTypes.indexOf(target.stage);
    const nextStageType = state.stageTypes[stageIndex + 1];
    if (!nextStageType) return; // that was the FINAL — bracket is complete, champion derived in getStatus

    const winners = [...stageMatches]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((match) =>
        resolveCupWinner({
          matchId: match.matchId,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeScore: match.homeScore ?? 0,
          awayScore: match.awayScore ?? 0,
        }),
      );

    const nextMatches: InternalCupMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      const home = winners[i];
      const away = winners[i + 1];
      if (home === undefined || away === undefined) continue;
      nextMatches.push({
        matchId: randomUUID(),
        stage: nextStageType,
        slotIndex: nextMatches.length,
        homeTeamId: home,
        awayTeamId: away,
        homeScore: null,
        awayScore: null,
      });
    }
    state.matchesByStage.set(nextStageType, nextMatches);
  }

  async getStatus(tournamentId: string): Promise<CupStatusRecord> {
    const state = this.cups.get(tournamentId);
    if (!state) return { tournamentId, stages: [], championTeamName: null };

    const stages = state.stageTypes
      .filter((stageType) => (state.matchesByStage.get(stageType) ?? []).length > 0)
      .map((stageType) => {
        const matches = state.matchesByStage.get(stageType) ?? [];
        return matches.map((match) => {
          const decided = match.homeScore !== null && match.awayScore !== null;
          const winnerTeamId = decided
            ? resolveCupWinner({
                matchId: match.matchId,
                homeTeamId: match.homeTeamId,
                awayTeamId: match.awayTeamId,
                homeScore: match.homeScore ?? 0,
                awayScore: match.awayScore ?? 0,
              })
            : null;
          return {
            stage: stageType,
            homeTeamName: state.teamNameById.get(match.homeTeamId) ?? match.homeTeamId,
            awayTeamName: state.teamNameById.get(match.awayTeamId) ?? match.awayTeamId,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            winnerTeamName: winnerTeamId ? (state.teamNameById.get(winnerTeamId) ?? winnerTeamId) : null,
          };
        });
      })
      .flat();

    const finalStageType = state.stageTypes[state.stageTypes.length - 1];
    const finalMatch = (state.matchesByStage.get(finalStageType ?? "FINAL") ?? [])[0];
    const championTeamName =
      finalMatch && finalMatch.homeScore !== null && finalMatch.awayScore !== null
        ? (state.teamNameById.get(
            resolveCupWinner({
              matchId: finalMatch.matchId,
              homeTeamId: finalMatch.homeTeamId,
              awayTeamId: finalMatch.awayTeamId,
              homeScore: finalMatch.homeScore,
              awayScore: finalMatch.awayScore,
            }),
          ) ?? null)
        : null;

    return { tournamentId, stages, championTeamName };
  }
}
