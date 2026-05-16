/** Weekly matchup roster display: highest scorers first; empty bench slots last. */
export function sortMatchupRosterRowsByWeekPointsDesc<
  T extends { name: string; points: number; wrestlerId?: string | null | undefined },
>(rows: T[]): T[] {
  const indexed = rows.map((row, i) => ({ row, i }));
  indexed.sort((a, b) => {
    const ar = a.row;
    const br = b.row;
    const aFill = Boolean(ar.wrestlerId);
    const bFill = Boolean(br.wrestlerId);
    if (!aFill && !bFill) return a.i - b.i;
    if (!aFill) return 1;
    if (!bFill) return -1;
    if (br.points !== ar.points) return br.points - ar.points;
    const byName = ar.name.localeCompare(br.name);
    if (byName !== 0) return byName;
    return a.i - b.i;
  });
  return indexed.map((x) => x.row);
}
