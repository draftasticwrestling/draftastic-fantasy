/** Max length for saved custom faction name (`league_members.team_name`). */
export const FACTION_NAME_MAX_LENGTH = 25;

export type FactionMemberLike = {
  team_name?: string | null;
  display_name?: string | null;
};

/** Trim and cap length for UI. Uses ellipsis when shortened. */
export function truncateFactionDisplay(s: string, max = FACTION_NAME_MAX_LENGTH): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const chars = Array.from(t);
  const sliceLen = Math.max(1, max - 1);
  return chars.slice(0, sliceLen).join("") + "\u2026";
}

/**
 * Label for standings: custom team name, or "{display}'s Faction" when unset.
 * Entire string is capped at max length so long profile names don’t blow layouts.
 */
export function factionStandingsLabel(
  m: FactionMemberLike,
  ownerFallback = "Unknown"
): string {
  const custom = m.team_name?.trim();
  if (custom) return truncateFactionDisplay(custom);
  const owner = (m.display_name?.trim() || ownerFallback).trim() || ownerFallback;
  const built = `${owner}'s Faction`;
  return truncateFactionDisplay(built);
}

/**
 * General UI: prefer custom `team_name`, else profile `display_name`, else fallback.
 * All branches truncated so default (long username) stays within layout budget.
 */
export function factionDisplayName(
  m: FactionMemberLike | null | undefined,
  fallback = "Unknown"
): string {
  if (!m) return truncateFactionDisplay(fallback);
  const custom = m.team_name?.trim();
  if (custom) return truncateFactionDisplay(custom);
  const dn = m.display_name?.trim();
  if (dn) return truncateFactionDisplay(dn);
  return truncateFactionDisplay(fallback);
}

export function validateFactionNameForSave(raw: string | null): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw == null || !String(raw).trim()) return { ok: true, value: null };
  const t = String(raw).trim();
  if (t.length > FACTION_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Faction name must be ${FACTION_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: t };
}
