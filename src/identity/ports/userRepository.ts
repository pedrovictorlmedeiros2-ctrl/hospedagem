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
}
