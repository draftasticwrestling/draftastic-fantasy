/**
 * Slugs that must never be in the draft pool (non-wrestlers, announcers, executives, etc.).
 * Used by server (leagueDraft) and client (TestDraft) so auto-pick never selects them.
 */

const BLOCKLIST = new Set([
  "adam-pearce",
  "aj-styles",
  "andrade",
  "andrade-el-idolo",
  "bad-bunny",
  "corey-graves",
  "triple-h",
  "hhh",
  "hunter-helmsley",
  "hunter-helst-helmsley",
  "paul-levesque",
  "paul-levaque",
  "john-cena",
  "trish-stratus",
  "uncle-howdy",
  "michael-cole",
  "pat-mcafee",
  "wade-barrett",
  "byron-saxton",
  "vic-joseph",
  "booker-t",
  "jerry-lawler",
  "tom-phillips",
  "goldberg",
  "tommaso-ciampa",
  "dakota-kai",
  "karrion-kross",
]);

export function isBlocklistedSlug(id: string | null | undefined): boolean {
  if (id == null || typeof id !== "string") return false;
  const slug = id.trim().toLowerCase();
  return slug.length > 0 && BLOCKLIST.has(slug);
}
