/** Weekly H2H / matchup team total — always two decimal places (e.g. 13.80, 4.00). */
export function formatMatchupTotalPts(n: number): string {
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}
