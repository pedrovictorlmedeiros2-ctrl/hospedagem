import type { CareerStage } from "@prisma/client";
import type { RecordCategory } from "../../global/domain/records.js";

/** Structured input for a world-record news article — see domain/templates.ts and ports/narrativeGenerator.ts. */
export interface RecordBrokenFacts {
  kind: "RECORD_BROKEN";
  category: RecordCategory;
  holderNickname: string;
  value: number;
  previousHolderNickname: string | null;
  previousValue: number | null;
}

/** Structured input for a coach pep talk, addressed to the player in second person. */
export interface CoachMessageFacts {
  kind: "COACH_MESSAGE";
  nickname: string;
  careerStage: CareerStage;
  seasonMatches: number;
  seasonGoals: number;
  seasonAssists: number;
  avgRating: number;
  hasActiveInjury: boolean;
}

/** Structured input for a post-match-style interview answer, spoken by the player in first person. */
export interface InterviewFacts {
  kind: "INTERVIEW";
  nickname: string;
  question: string;
  careerStage: CareerStage;
  seasonMatches: number;
  seasonGoals: number;
  seasonAssists: number;
  avgRating: number;
}

export type NarrativeFacts = RecordBrokenFacts | CoachMessageFacts | InterviewFacts;
