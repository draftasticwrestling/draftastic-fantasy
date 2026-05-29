/**
 * Competition-style ranks for sorted leaderboards: tied scores share the same place
 * (1, 2, 3, 3, 5, …). Input must already be sorted by points descending.
 */
export function assignCompetitionRanks<T extends { points: number }>(
  sortedRows: T[]
): (T & { rank: number })[] {
  let currentRank = 0;
  let previousPoints: number | null = null;
  return sortedRows.map((entry, idx) => {
    if (previousPoints === null || entry.points !== previousPoints) {
      currentRank = idx + 1;
      previousPoints = entry.points;
    }
    return { ...entry, rank: currentRank };
  });
}
