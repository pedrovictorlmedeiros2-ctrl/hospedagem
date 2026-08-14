// Matches scheme://user:pass@host connection strings (Postgres, MySQL,
// MongoDB, ...) regardless of scheme — a raw Prisma connection error can
// include the full DATABASE_URL, credentials and all, in its message.
const CONNECTION_STRING_PATTERN = /(\w+:\/\/)[^@\s]+@/g;

/**
 * Strips connection strings and any known secret value out of a string
 * before it's ever handed to the logger. See RISK_REGISTER.md risco #9.
 */
export function redactSecrets(text: string, secrets: readonly string[] = []): string {
  let result = text.replace(CONNECTION_STRING_PATTERN, "$1***:***@");
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    result = result.split(secret).join("***");
  }
  return result;
}

/**
 * Same as redactSecrets, but for a caught `unknown` error — the shape
 * every catch block in this codebase actually receives. Non-Error,
 * non-string values (already-structured data) pass through unchanged;
 * there's nothing free-text to scan for a leaked secret.
 */
export function redactError(error: unknown, secrets: readonly string[] = []): unknown {
  if (error instanceof Error) {
    const redacted = new Error(redactSecrets(error.message, secrets));
    redacted.name = error.name;
    if (error.stack) {
      redacted.stack = redactSecrets(error.stack, secrets);
    }
    return redacted;
  }
  if (typeof error === "string") {
    return redactSecrets(error, secrets);
  }
  return error;
}
