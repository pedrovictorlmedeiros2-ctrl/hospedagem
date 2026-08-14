export interface FinishedResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

export interface StandingRow {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

function emptyRow(teamId: string): StandingRow {
  return { teamId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
}

/**
 * Standard 3-1-0 league table, computed fresh from finished results every
 * time rather than stored and kept in sync — there is exactly one source
 * of truth (the Match rows) and no cache invalidation to get wrong.
 * Sorted by points, then goal difference, then goals for (classic
 * tie-break order), then teamId for a fully deterministic order.
 */
export function computeStandings(teamIds: string[], results: FinishedResult[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const teamId of teamIds) rows.set(teamId, emptyRow(teamId));

  for (const result of results) {
    const home = rows.get(result.homeTeamId);
    const away = rows.get(result.awayTeamId);
    if (!home || !away) continue; // result for a team outside this table — ignore rather than throw, callers may pass a superset

    home.played += 1;
    away.played += 1;
    home.goalsFor += result.homeScore;
    home.goalsAgainst += result.awayScore;
    away.goalsFor += result.awayScore;
    away.goalsAgainst += result.homeScore;

    if (result.homeScore > result.awayScore) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (result.homeScore < result.awayScore) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId),
  );
}
