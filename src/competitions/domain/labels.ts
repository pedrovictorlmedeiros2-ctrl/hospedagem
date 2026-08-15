import type { StageType } from "@prisma/client";

export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  GROUP: "Fase de grupos",
  ROUND_OF_32: "16-avos de final",
  ROUND_OF_16: "Oitavas de final",
  QUARTER_FINAL: "Quartas de final",
  SEMI_FINAL: "Semifinal",
  FINAL: "Final",
};
