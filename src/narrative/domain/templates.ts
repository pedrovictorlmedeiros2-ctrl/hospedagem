import { CAREER_STAGE_LABELS } from "../../career/domain/labels.js";
import { RECORD_CATEGORY_LABELS } from "../../global/domain/records.js";
import type { CoachMessageFacts, InterviewFacts, RecordBrokenFacts } from "./narrativeFacts.js";

/**
 * Pure, deterministic text generation — no I/O, no randomness. This is the
 * fallback the narrative layer always has available when Groq is
 * unreachable, misconfigured, or returns something unusable (see
 * adapters/fallbackNarrativeGenerator.ts) — the game's narrative features
 * must never break just because an external LLM is down.
 */
export function templateNewsArticle(facts: RecordBrokenFacts): { headline: string; body: string } {
  const label = RECORD_CATEGORY_LABELS[facts.category];
  const headline = `${facts.holderNickname} estabelece novo recorde mundial: ${label}`;

  const bodyLines = [
    `${facts.holderNickname} quebrou o recorde mundial de "${label}", atingindo a marca de ${facts.value.toFixed(0)}.`,
  ];
  if (facts.previousHolderNickname !== null && facts.previousValue !== null) {
    bodyLines.push(`O recorde anterior pertencia a ${facts.previousHolderNickname}, com ${facts.previousValue.toFixed(0)}.`);
  } else {
    bodyLines.push("Este é o primeiro recorde já registrado nessa categoria.");
  }

  return { headline, body: bodyLines.join(" ") };
}

export function templateCoachMessage(facts: CoachMessageFacts): string {
  const stageLabel = CAREER_STAGE_LABELS[facts.careerStage];
  const lines = [
    `${facts.nickname}, você está como ${stageLabel} com ${facts.seasonMatches} partida(s) nesta temporada.`,
    `${facts.seasonGoals} gol(s) e ${facts.seasonAssists} assistência(s), média de nota ${facts.avgRating.toFixed(1)}.`,
  ];

  if (facts.hasActiveInjury) {
    lines.push("Foque na recuperação antes de forçar o corpo de novo.");
  } else if (facts.avgRating >= 7.5) {
    lines.push("Continue assim — seu desempenho está acima da média do elenco.");
  } else {
    lines.push("Continue treinando com foco — cada sessão conta pro seu desenvolvimento.");
  }

  return lines.join(" ");
}

export function templateInterviewAnswer(facts: InterviewFacts): string {
  const stageLabel = CAREER_STAGE_LABELS[facts.careerStage];
  return [
    `Sobre "${facts.question}":`,
    `"Estou na fase de ${stageLabel}, com ${facts.seasonMatches} partida(s) e ${facts.seasonGoals} gol(s) nesta temporada.`,
    `Minha média de nota está em ${facts.avgRating.toFixed(1)} — o trabalho continua."`,
  ].join(" ");
}
