import type { PlayStyle, Position, PreferredFoot } from "@prisma/client";

export interface PlayerRecord {
  id: string;
  userId: string;
  name: string;
  nickname: string;
  nationality: string;
  birthDate: Date;
  position: Position;
  preferredFoot: PreferredFoot;
  heightCm: number;
  playStyle: PlayStyle;
  shirtNumber: number | null;
  bio: string | null;
  celebration: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  theme: string | null;
  cardStyle: string | null;
  profileFrame: string | null;
  profileBackground: string | null;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  gkReflexes: number | null;
  gkPositioning: number | null;
  gkHandling: number | null;
  gkAerial: number | null;
  gkOneOnOne: number | null;
  gkPenalties: number | null;
  overall: number;
  form: number;
  globalRating: number;
  stamina: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPlayerRecord {
  /** Internal `User.id` — NEVER a raw Discord snowflake. See identity/ports/userRepository.ts. */
  userId: string;
  name: string;
  nickname: string;
  nationality: string;
  birthDate: Date;
  position: Position;
  preferredFoot: PreferredFoot;
  heightCm: number;
  playStyle: PlayStyle;
  shirtNumber: number | null;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  gkReflexes: number | null;
  gkPositioning: number | null;
  gkHandling: number | null;
  gkAerial: number | null;
  gkOneOnOne: number | null;
  gkPenalties: number | null;
  overall: number;
}

export interface PlayerProfilePatch {
  name?: string;
  nickname?: string;
  shirtNumber?: number | null;
  bio?: string | null;
  celebration?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  theme?: string | null;
  cardStyle?: string | null;
  profileFrame?: string | null;
  profileBackground?: string | null;
}

/**
 * Port for player-profile persistence. `create` and `update` MUST each
 * provide their own atomicity guarantee for concurrent calls on the same
 * userId (a DB unique constraint for PrismaPlayerRepository; a synchronous
 * check-and-set for InMemoryPlayerRepository). Callers rely on that
 * guarantee — a pre-check-then-write pattern in the service layer is a UX
 * shortcut for a friendlier error message, never the actual safety net.
 */
export interface PlayerRepository {
  create(input: NewPlayerRecord): Promise<PlayerRecord>;
  findByUserId(userId: string): Promise<PlayerRecord | null>;
  update(userId: string, patch: PlayerProfilePatch): Promise<PlayerRecord>;
}
