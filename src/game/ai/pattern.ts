import type { AttackAction } from "../domain/types.js";
import type { PatternMemory } from "../domain/state.js";

const WINDOW_SIZE = 5;
const REPETITION_THRESHOLD = 3;

export function createPatternMemory(): PatternMemory {
  return { recentActions: [] };
}

export function recordAction(memory: PatternMemory, action: AttackAction): void {
  memory.recentActions.push(action);
  if (memory.recentActions.length > WINDOW_SIZE) {
    memory.recentActions.shift();
  }
}

/**
 * "Jogador sempre corta para a direita → defensor percebe o padrão →
 * fecha o espaço" (product spec, IA adaptativa). If the same action shows
 * up at least REPETITION_THRESHOLD times in the last WINDOW_SIZE attacks,
 * the defense gets a bonus against that specific action — a real,
 * deterministic form of in-match adaptation, not a difficulty slider.
 */
export function patternReadBonus(memory: PatternMemory, candidateAction: AttackAction): number {
  const repetitions = memory.recentActions.filter((action) => action === candidateAction).length;
  if (repetitions < REPETITION_THRESHOLD) return 0;

  const excess = repetitions - REPETITION_THRESHOLD + 1;
  return Math.min(18, excess * 6);
}
