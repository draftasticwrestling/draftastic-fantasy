/**
 * Maps championship title names (from championship_history / Boxscore) to belt image URLs
 * for overlay on wrestler profile images when they are current champion.
 * When the title is ambiguous (e.g. "Intercontinental Championship" with no "Women's"),
 * wrestler gender is used to pick the correct belt (women's = white, men's = black).
 */

import type { BeltKey } from "@/lib/howItWorksImages";
import { BELT_IMAGE_URLS } from "@/lib/howItWorksImages";

function isFemale(gender: string | null | undefined): boolean {
  if (!gender || typeof gender !== "string") return false;
  const g = gender.toLowerCase().trim();
  return g === "f" || g === "female" || g === "woman" || g === "women";
}

function isMale(gender: string | null | undefined): boolean {
  if (!gender || typeof gender !== "string") return false;
  const g = gender.toLowerCase().trim();
  return g === "m" || g === "male" || g === "man" || g === "men";
}

/** Match title name to BeltKey; order is most specific first. */
const TITLE_TO_BELT: { pattern: RegExp; key: BeltKey }[] = [
  { pattern: /undisputed\s+wwe|wwe\s+undisputed|wwe\s+championship(?!\s+women)/i, key: "undisputed-wwe" },
  { pattern: /world\s+heavyweight|heavyweight\s+championship/i, key: "heavyweight" },
  { pattern: /wwe\s+women'?s?|women'?s?\s+wwe\s+championship/i, key: "wwe-womens" },
  { pattern: /women'?s?\s+world\s+championship|women'?s?\s+world\s+champion/i, key: "womens-world" },
  { pattern: /women'?s?\s+intercontinental/i, key: "intercontinental-womens" },
  { pattern: /intercontinental|\bic\b/i, key: "intercontinental-mens" },
  { pattern: /women'?s?\s+united\s+states|women'?s?\s+u\.?s\.?/i, key: "us-womens" },
  { pattern: /united\s+states|\b(us|u\.s\.)\s+championship/i, key: "us-mens" },
  { pattern: /women'?s?\s+tag/i, key: "tag-team-womens" },
  { pattern: /tag\s+team|raw\s+tag|smackdown\s+tag|world\s+tag/i, key: "tag-team-mens" },
];

/** Ambiguous titles (no explicit "women's") where we use wrestler gender to pick women's vs men's belt. */
const GENDER_OVERRIDE: { key: BeltKey; womenKey: BeltKey }[] = [
  { key: "intercontinental-mens", womenKey: "intercontinental-womens" },
  { key: "us-mens", womenKey: "us-womens" },
  { key: "tag-team-mens", womenKey: "tag-team-womens" },
];

/**
 * Returns the belt image URL for a championship title name, or null if no match.
 * When the title is ambiguous (e.g. "Intercontinental Championship" without "Women's"),
 * pass wrestlerGender so the correct belt is shown (e.g. Female → women's white Intercontinental).
 */
export function getBeltImageUrlForTitle(
  titleName: string | null | undefined,
  wrestlerGender?: string | null
): string | null {
  if (!titleName || typeof titleName !== "string") return null;
  const trimmed = titleName.trim();
  if (!trimmed) return null;
  for (const { pattern, key } of TITLE_TO_BELT) {
    if (pattern.test(trimmed)) {
      let beltKey: BeltKey = key;
      const override = GENDER_OVERRIDE.find((o) => o.key === key);
      if (override && isFemale(wrestlerGender)) {
        beltKey = override.womenKey;
      }
      const url = BELT_IMAGE_URLS[beltKey];
      return url ?? null;
    }
  }
  return null;
}
