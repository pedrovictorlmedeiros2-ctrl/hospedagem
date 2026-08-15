export type PenaltyCorner = "LEFT" | "CENTER" | "RIGHT";
export type PenaltyPower = "PLACED" | "POWERFUL";

export interface PenaltyChoice {
  corner: PenaltyCorner;
  power: PenaltyPower;
}

export const PENALTY_CORNER_LABELS: Record<PenaltyCorner, string> = {
  LEFT: "⬅️ Esquerda",
  CENTER: "⬆️ Meio",
  RIGHT: "➡️ Direita",
};

export const PENALTY_POWER_LABELS: Record<PenaltyPower, string> = {
  PLACED: "🎯 Colocado",
  POWERFUL: "💥 Forte",
};
