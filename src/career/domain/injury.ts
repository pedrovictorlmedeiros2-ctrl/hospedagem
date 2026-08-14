import type { InjurySeverity } from "@prisma/client";
import { randomInt, weightedPick, type Rng } from "../../game/domain/rng.js";

const DIAGNOSIS_BY_SEVERITY: Record<InjurySeverity, string> = {
  MINOR: "Contusão leve",
  MODERATE: "Lesão muscular",
  SEVERE: "Lesão grave",
};

const RECOVERY_DAYS_RANGE: Record<InjurySeverity, readonly [number, number]> = {
  MINOR: [3, 5],
  MODERATE: [10, 14],
  SEVERE: [21, 35],
};

export interface RolledInjury {
  severity: InjurySeverity;
  diagnosis: string;
  expectedReturnAt: Date;
}

/** Called once the match engine already flagged that a real INJURY event happened to the real player — this only decides how bad it is. */
export function rollInjury(rng: Rng, occurredAt: Date): RolledInjury {
  const severity = weightedPick<InjurySeverity>(rng, [
    ["MINOR", 60],
    ["MODERATE", 30],
    ["SEVERE", 10],
  ]);
  const [minDays, maxDays] = RECOVERY_DAYS_RANGE[severity];
  const days = randomInt(rng, minDays, maxDays);
  const expectedReturnAt = new Date(occurredAt.getTime() + days * 24 * 60 * 60 * 1000);

  return { severity, diagnosis: DIAGNOSIS_BY_SEVERITY[severity], expectedReturnAt };
}
