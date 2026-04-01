/**
 * Wrestlers page: fixed order for WWE main-roster titles (Current Champions + Title History).
 * Row 1: world titles; Row 2: IC + US; Row 3: tag team.
 */

function displayOrderIndex(title: string): number {
  const t = title.trim().toLowerCase();

  // Row 1
  if (/undisputed\s+wwe|wwe\s+undisputed/.test(t)) return 0;
  if (/^wwe\s+championship\b/.test(t) && !/women/.test(t)) return 0;
  if (/\bwwe\s+women'?s?\s+championship\b/.test(t)) return 1;
  if (/world\s+heavyweight/.test(t)) return 2;
  if (/women'?s?\s+world/.test(t)) return 3;

  // Row 2 (women's variants before generic men's patterns)
  if (/women'?s?\s+intercontinental/.test(t)) return 5;
  if (/intercontinental|\bic\b/.test(t)) return 4;
  if (/women'?s?\s+united\s+states|women'?s?\s+u\.?s\.?\s+championship\b/.test(t)) return 7;
  if (/united\s+states|\bu\.?s\.?\s+championship\b/.test(t)) return 6;

  // Row 3
  if (/raw\s+tag/.test(t)) return 8;
  if (/smackdown\s+tag/.test(t)) return 9;
  if (/women'?s?\s+tag/.test(t)) return 10;
  if (/world\s+tag|tag\s+team/.test(t)) return 11;

  return 1000;
}

export function compareChampionshipTitleNames(a: string, b: string): number {
  const da = displayOrderIndex(a);
  const db = displayOrderIndex(b);
  if (da !== db) return da - db;
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function sortByChampionshipDisplayOrder<T extends { title: string }>(cards: T[]): T[] {
  return [...cards].sort((x, y) => compareChampionshipTitleNames(x.title, y.title));
}
