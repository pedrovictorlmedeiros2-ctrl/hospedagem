import type { PlayStyle, Position, PreferredFoot } from "@prisma/client";
import type { CoreAttributes, GoalkeeperAttributes } from "./attributes.js";

export const POSITION_LABELS: Record<Position, string> = {
  GK: "Goleiro",
  CB: "Zagueiro",
  LB: "Lateral-esquerdo",
  RB: "Lateral-direito",
  DM: "Volante",
  CM: "Meio-campista",
  AM: "Meia-atacante",
  LM: "Meia-esquerda",
  RM: "Meia-direita",
  LW: "Ponta-esquerda",
  RW: "Ponta-direita",
  ST: "Centroavante",
};

export const FOOT_LABELS: Record<PreferredFoot, string> = {
  LEFT: "Esquerdo",
  RIGHT: "Direito",
  BOTH: "Ambidestro",
};

export const PLAYSTYLE_LABELS: Record<PlayStyle, string> = {
  BALANCED: "Equilibrado",
  POACHER: "Oportunista",
  PLAYMAKER: "Armador",
  ENGINE: "Box-to-box",
  DEFENSIVE: "Defensivo",
  WINGER: "Ponta",
  TARGET_MAN: "Pivô",
  SWEEPER_KEEPER: "Goleiro-líbero",
  SHOT_STOPPER: "Goleiro reflexo",
};

export const THEME_LABELS = {
  classic: "Clássico",
  midnight: "Meia-noite",
  gold: "Ouro",
  neon: "Neon",
} as const;

export const CARD_STYLE_LABELS = {
  classic: "Clássico",
  holo: "Holográfico",
  retro: "Retrô",
  minimal: "Minimalista",
} as const;

export const FRAME_LABELS = {
  bronze: "Bronze",
  silver: "Prata",
  gold: "Ouro",
  elite: "Elite",
} as const;

export const BACKGROUND_LABELS = {
  stadium: "Estádio",
  "training-ground": "Centro de treinamento",
  "night-city": "Cidade à noite",
  gradient: "Gradiente",
} as const;

/** 3-letter abbreviations, FIFA-card style — used by the compact attribute bars in profileCard. Order matches the canonical outfield attribute order used throughout the domain (see attributes.ts). */
export const CORE_ATTRIBUTE_SHORT_LABELS: Record<keyof CoreAttributes, string> = {
  pace: "RIT",
  shooting: "FIN",
  passing: "PAS",
  dribbling: "DRI",
  defending: "MAR",
  physical: "FIS",
};

export const GOALKEEPER_ATTRIBUTE_SHORT_LABELS: Record<keyof GoalkeeperAttributes, string> = {
  gkReflexes: "REF",
  gkPositioning: "POS",
  gkHandling: "SEG",
  gkAerial: "AER",
  gkOneOnOne: "1v1",
  gkPenalties: "PEN",
};

export const THEME_CHOICES = Object.keys(THEME_LABELS) as (keyof typeof THEME_LABELS)[];
export const CARD_STYLE_CHOICES = Object.keys(
  CARD_STYLE_LABELS,
) as (keyof typeof CARD_STYLE_LABELS)[];
export const FRAME_CHOICES = Object.keys(FRAME_LABELS) as (keyof typeof FRAME_LABELS)[];
export const BACKGROUND_CHOICES = Object.keys(
  BACKGROUND_LABELS,
) as (keyof typeof BACKGROUND_LABELS)[];
