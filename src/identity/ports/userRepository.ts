export interface UserRecord {
  id: string;
  discordId: string;
}

/**
 * Resolves the internal `User.id` (referenced by every other entity via
 * foreign key) from a Discord snowflake. Discord IDs are never used
 * directly as a foreign key elsewhere in the schema — this is the one
 * place that boundary is crossed.
 */
export interface UserRepository {
  ensureUserForDiscordId(discordId: string): Promise<UserRecord>;
  /** Reverse lookup — internal id back to the Discord snowflake. Needed wherever a stored foreign key (e.g. Duel.challengerId) has to be displayed or mentioned back to a Discord user. */
  getById(userId: string): Promise<UserRecord | null>;
}
