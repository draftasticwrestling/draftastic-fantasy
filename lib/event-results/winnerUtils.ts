/** Whether this scored participant is in the parser-derived winners list (names or slugs). */
export function isWrestlerWinner(
  wrestlerKey: string,
  winners: unknown[] | undefined,
  normalizeWrestlerName: (s: string) => string | null
): boolean {
  if (!winners?.length) return false;
  const a = normalizeWrestlerName(wrestlerKey) || wrestlerKey.toLowerCase().trim();
  return winners.some((w) => {
    const s = String(w);
    const b = normalizeWrestlerName(s) || s.toLowerCase().trim();
    return a === b || wrestlerKey === s;
  });
}
