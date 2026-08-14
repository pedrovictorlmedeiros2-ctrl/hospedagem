import { ensureCareerStarted, type EnsureCareerStartedDeps } from "../../career/services/ensureCareerStarted.js";
import type { MatchRepository } from "../../game/ports/matchRepository.js";
import type { CoachMessageFacts } from "../domain/narrativeFacts.js";
import type { NarrativeGenerator } from "../ports/narrativeGenerator.js";

export interface AskCoachDeps extends EnsureCareerStartedDeps {
  matchRepository: MatchRepository;
  narrativeGenerator: NarrativeGenerator;
}

export interface AskCoachInput {
  discordId: string;
  now?: Date;
}

export interface AskCoachOutput {
  message: string;
}

export async function askCoach(deps: AskCoachDeps, input: AskCoachInput): Promise<AskCoachOutput> {
  const now = input.now ?? new Date();
  const { player, career, season } = await ensureCareerStarted(deps, input.discordId);

  const [seasonStat, hasActiveInjury] = await Promise.all([
    deps.matchRepository.getPlayerSeasonStat(player.id, season.id),
    deps.careerRepository.hasActiveInjury(player.id, now),
  ]);

  const facts: CoachMessageFacts = {
    kind: "COACH_MESSAGE",
    nickname: player.nickname,
    careerStage: career.stage,
    seasonMatches: seasonStat?.matches ?? 0,
    seasonGoals: seasonStat?.goals ?? 0,
    seasonAssists: seasonStat?.assists ?? 0,
    avgRating: seasonStat?.avgRating ?? 0,
    hasActiveInjury,
  };

  const message = await deps.narrativeGenerator.generateCoachMessage(facts);
  return { message };
}
