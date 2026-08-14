import type { CareerStage } from "@prisma/client";

export const CAREER_STAGE_LABELS: Record<CareerStage, string> = {
  BASE: "Base",
  RESERVE: "Reserva",
  PROFESSIONAL: "Profissional",
  STARTER: "Titular",
  STANDOUT: "Destaque",
  NATIONAL_TEAM: "Seleção",
  LEGACY: "Legado",
};
