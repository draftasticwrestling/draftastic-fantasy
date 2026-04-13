/**
 * Maps `wrestlers.brand` to the roster bucket shown in the "Roster" column on /wrestlers
 * (Raw, SmackDown, NXT, AAA, …). Autopick eligibility for "main roster" uses the same mapping.
 */

export type WrestlerRosterBucket =
  | "Unassigned"
  | "Raw"
  | "SmackDown"
  | "NXT"
  | "AAA"
  | "Celebrity Guests"
  | "Alumni"
  | "Front Office"
  | "Other";

/**
 * Normalize the DB `brand` string to a roster bucket (matches the public wrestler grid).
 * Longer Boxscore/PWBS labels (e.g. "Monday Night Raw") map to Raw / SmackDown, not "Other".
 */
export function wrestlerRosterFromBrand(brand: string | null | undefined): WrestlerRosterBucket {
  if (!brand?.trim()) return "Unassigned";
  const l = brand.trim().toLowerCase();

  if (l === "nxt" || l.includes("nxt")) return "NXT";

  // WWE marketing / PWBS-style labels that are clearly SmackDown (check before Raw: avoid "raw" substring false positives).
  if (
    l === "smackdown" ||
    l === "smack down" ||
    l.includes("smackdown") ||
    l.includes("smack down") ||
    l.includes("blue brand") ||
    l.includes("friday night") ||
    (l.includes("fox") && (l.includes("wwe") || l.includes("smack")))
  ) {
    return "SmackDown";
  }

  if (
    l === "raw" ||
    l.includes("monday night raw") ||
    l.includes("wwe raw") ||
    l.includes("red brand") ||
    /\braw\b/.test(l)
  ) {
    return "Raw";
  }

  if (l === "aaa") return "AAA";

  if (
    l === "celebrity guests" ||
    l === "celebrity" ||
    l === "celebrity guest" ||
    l === "celebrity guests"
  ) {
    return "Celebrity Guests";
  }

  if (l === "alumni" || l === "legend" || l === "legends" || l === "hall of fame") return "Alumni";

  if (
    l === "managers" ||
    l === "manager" ||
    l === "gm" ||
    l === "gms" ||
    l === "head of creative" ||
    l === "announcers" ||
    l === "announcer" ||
    l === "commentary" ||
    l === "commentator" ||
    l === "commentators" ||
    l === "authority" ||
    l === "authority figure" ||
    l === "general manager" ||
    l === "executive" ||
    l === "executives" ||
    l === "chief content officer" ||
    l === "cco" ||
    l === "staff" ||
    l === "wwe staff" ||
    l === "backstage" ||
    l === "producer" ||
    l === "producers" ||
    l === "writer" ||
    l === "creative" ||
    l === "broadcast" ||
    l === "on-air personality" ||
    l === "personality" ||
    l === "broadcast team"
  ) {
    return "Front Office";
  }

  return "Other";
}

/** Autopick (simplified league): only wrestlers whose roster is Raw or SmackDown on the main WWE shows. */
export function isRawOrSmackDownWrestlerRoster(brand: string | null | undefined): boolean {
  const r = wrestlerRosterFromBrand(brand);
  return r === "Raw" || r === "SmackDown";
}
