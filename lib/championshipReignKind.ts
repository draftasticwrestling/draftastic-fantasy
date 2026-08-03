/**
 * Reign classification for dual-champion (interim + inactive injured) periods.
 * null / sole = normal single open reign (or unspecified legacy rows).
 */
export type ChampionshipReignKind = "sole" | "interim" | "inactive_injured";

export const INTERIM_CHAMPION_EVENT_LABEL = "Interim champion";

export function normalizeReignKind(raw: unknown): ChampionshipReignKind | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "interim") return "interim";
  if (s === "inactive_injured" || s === "inactive") return "inactive_injured";
  if (s === "sole") return "sole";
  return null;
}

export function reignKindLabel(kind: ChampionshipReignKind | null | undefined): string | null {
  if (kind === "interim") return "Interim";
  if (kind === "inactive_injured") return "Inactive";
  if (kind === "sole") return "Sole";
  return null;
}

const HOLDER_SUFFIX_RE = /\s*\((interim|inactive)\)\s*$/i;

/** Display label for roster/profile under-name lines. Only interim is annotated. */
export function formatChampionshipTitleForHolder(
  title: string,
  reignKind: ChampionshipReignKind | null | undefined
): string {
  const base = stripChampionshipTitleHolderSuffix(title);
  if (!base) return title?.trim() ?? "";
  if (normalizeReignKind(reignKind) === "interim") return `${base} (Interim)`;
  return base;
}

/** Strip display-only holder suffixes before belt/PWBS matching. */
export function stripChampionshipTitleHolderSuffix(title: string | null | undefined): string {
  if (!title || typeof title !== "string") return "";
  return title.trim().replace(HOLDER_SUFFIX_RE, "").trim();
}
