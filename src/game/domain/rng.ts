/**
 * Deterministic, seeded PRNG. NOT `Math.random()` — the same seed must
 * always produce the same sequence, which is what makes a simulated match
 * reproducible (`Match.simulationSeed` in the schema) and the engine
 * actually testable. Correctness of the *simulation* only depends on this
 * being deterministic and reasonably well-distributed, not on
 * cryptographic quality.
 */
export type Rng = () => number;

/** djb2 string hash, folded into a 32-bit unsigned integer seed. */
function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return hash >>> 0;
}

/** mulberry32 — small, fast, well-distributed enough for game simulation. */
function mulberry32(initialState: number): Rng {
  let state = initialState;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  return mulberry32(hashSeed(seed));
}

/** Uniform random integer in [min, max], inclusive on both ends. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Picks one item from `entries` with probability proportional to its weight. */
export function weightedPick<T>(rng: Rng, entries: ReadonlyArray<readonly [T, number]>): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) {
    throw new Error("weightedPick: total weight must be positive");
  }

  let roll = rng() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  const last = entries[entries.length - 1];
  if (!last) {
    throw new Error("weightedPick: entries must not be empty");
  }
  return last[0];
}

/**
 * Resolves a contest between two ratings into a boolean win/lose for the
 * first rating, with a small amount of noise so a stronger side doesn't
 * win deterministically every time. `favorMultiplier` lets a caller tilt
 * the contest further (e.g. shots are harder than the raw attribute
 * comparison suggests, because most shots miss in real football).
 */
export function rollContest(rng: Rng, ratingA: number, ratingB: number, noise = 0.12): boolean {
  const safeA = Math.max(1, ratingA);
  const safeB = Math.max(1, ratingB);
  const baseProbability = safeA / (safeA + safeB);
  const jitter = (rng() - 0.5) * 2 * noise;
  const probability = Math.min(0.97, Math.max(0.03, baseProbability + jitter));
  return rng() < probability;
}
