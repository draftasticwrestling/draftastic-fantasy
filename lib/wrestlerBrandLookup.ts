import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";

/**
 * Map wrestler id/slug keys to `wrestlers.brand` for scoring rules (e.g. excluding main-roster NXT appearances).
 */
export function brandByWrestlerSlugFromRows(
  rows: ReadonlyArray<{ id: string; brand?: string | null | undefined }>
): Record<string, string | null | undefined> {
  const out: Record<string, string | null | undefined> = {};
  for (const w of rows) {
    if (!w?.id) continue;
    const id = String(w.id);
    const b = w.brand ?? null;
    out[id] = b;
    const norm = normalizeWrestlerName(id);
    if (norm) out[norm] = b;
  }
  return out;
}
