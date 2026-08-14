/**
 * `Rivalry.playerAId`/`playerBId` is a directional pair with a unique
 * constraint on `[playerAId, playerBId]` — without a canonical order, "A
 * vs B" and "B vs A" would create two separate rows for the same
 * rivalry, splitting its history in half. Sorting lexicographically by id
 * guarantees the same two players always map to the same slot
 * assignment, regardless of who's the challenger this time.
 */
export function canonicalizeRivalryPair(playerIdX: string, playerIdY: string): [string, string] {
  return playerIdX < playerIdY ? [playerIdX, playerIdY] : [playerIdY, playerIdX];
}
