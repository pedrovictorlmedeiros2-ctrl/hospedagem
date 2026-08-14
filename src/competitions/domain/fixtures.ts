const BYE = "__BYE__";

export interface Fixture {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

/**
 * Standard "circle method" round-robin scheduler: every team plays every
 * other team exactly once per leg. Odd team counts get a padded bye slot
 * that's filtered out of the result — nobody ever sees `__BYE__`.
 * `doubleRound` mirrors the whole schedule with home/away swapped
 * (turno e returno), like a real league season.
 */
export function generateRoundRobinFixtures(teamIds: string[], options: { doubleRound?: boolean } = {}): Fixture[] {
  if (teamIds.length < 2) {
    throw new Error("generateRoundRobinFixtures: need at least 2 teams");
  }
  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error("generateRoundRobinFixtures: duplicate team id");
  }

  const arr = [...teamIds];
  if (arr.length % 2 !== 0) arr.push(BYE);

  const n = arr.length;
  const rounds = n - 1;
  const half = n / 2;

  const fixtures: Fixture[] = [];
  let current = arr;

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a === undefined || b === undefined || a === BYE || b === BYE) continue;

      const swap = round % 2 === 1;
      fixtures.push({ round: round + 1, homeTeamId: swap ? b : a, awayTeamId: swap ? a : b });
    }

    const fixed = current[0];
    if (fixed === undefined) break;
    const rest = current.slice(1);
    const last = rest.pop();
    if (last !== undefined) rest.unshift(last);
    current = [fixed, ...rest];
  }

  if (!options.doubleRound) return fixtures;

  const secondLeg = fixtures.map((fixture) => ({
    round: fixture.round + rounds,
    homeTeamId: fixture.awayTeamId,
    awayTeamId: fixture.homeTeamId,
  }));

  return [...fixtures, ...secondLeg];
}
