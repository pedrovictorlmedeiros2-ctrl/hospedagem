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
  globalRating: number;
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
 * Gameplay attributes — distinct from PlayerProfilePatch (cosmetic/identity
 * fields, Fase 2). Written by training (Fase 4) and, later, match
 * performance. Never touched by /personalizar.
 */
export interface PlayerAttributesPatch {
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physical?: number;
  gkReflexes?: number | null;
  gkPositioning?: number | null;
  gkHandling?: number | null;
  gkAerial?: number | null;
  gkOneOnOne?: number | null;
  gkPenalties?: number | null;
  overall?: number;
  form?: number;
  stamina?: number;
  globalRating?: number;
}

/**
 * Port for player persistence. `create`, `update` and `updateAttributes`
 * MUST each provide their own atomicity guarantee for concurrent calls on
 * the same userId (a DB unique constraint for PrismaPlayerRepository; a
 * synchronous check-and-set for InMemoryPlayerRepository). Callers rely on
 * that guarantee — a pre-check-then-write pattern in the service layer is
 * a UX shortcut for a friendlier error message, never the actual safety
 * net.
 */
export type RankingMetric = "GLOBAL_RATING" | "OVERALL";

export interface ClaimCooldownResult {
  claimed: boolean;
  /** The cooldown's current start point, for building a "try again in Xh" message. Only meaningful when claimed is false. */
  lastClaimAt: Date | null;
}

export interface PlayerRepository {
  create(input: NewPlayerRecord): Promise<PlayerRecord>;
  findByUserId(userId: string): Promise<PlayerRecord | null>;
  /** Looks up by the player's own id (not the owning user's id) — needed wherever another player's identity must be resolved, e.g. a Record's holderPlayerId. */
  findById(playerId: string): Promise<PlayerRecord | null>;
  update(userId: string, patch: PlayerProfilePatch): Promise<PlayerRecord>;
  updateAttributes(userId: string, patch: PlayerAttributesPatch): Promise<PlayerRecord>;
  /** Highest-first. Computed live, not cached — see global/services/viewRanking.ts. */
  listTopPlayers(metric: RankingMetric, limit: number): Promise<PlayerRecord[]>;
  /**
   * Atomic compare-and-swap: claims the training-cooldown slot for this
   * player IF (and only if) `now` is at least `cooldownHours` past the
   * last successful claim, in one indivisible operation — so two
   * concurrent training attempts can never both win. Must be called as
   * the LAST gate right before mutating attributes/recording the
   * session, after every check that can legitimately fail on its own
   * (focus validity, stamina, insufficient funds for an intensive
   * session) — claiming and then failing on something else would waste
   * the player's cooldown slot for nothing. See career/services/trainPlayer.ts.
   */
  tryClaimTrainingCooldown(playerId: string, now: Date, cooldownHours: number): Promise<ClaimCooldownResult>;
}
