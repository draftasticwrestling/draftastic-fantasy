/**
 * Routes and display names aligned with prowrestlingboxscore.com/championship/{slug}.
 * Order is significant: more specific patterns must run before broader ones.
 */

/** @typedef {{ slug: string, displayTitle: string, test: (normalized: string) => boolean }} PwbsPage */

/** @type {readonly PwbsPage[]} */
const PWBS_CHAMPIONSHIP_PAGES = [
  {
    slug: "wwe-championship",
    /** Matches PWBS copy for this route (unified / undisputed lineage on one timeline). */
    displayTitle: "Undisputed WWE Championship",
    test: (t) =>
      /undisputed\s+wwe|wwe\s+undisputed/i.test(t) ||
      (/^wwe\s+championship\b/i.test(t) && !/women/i.test(t)),
  },
  {
    slug: "wwe-womens-championship",
    displayTitle: "WWE Women's Championship",
    test: (t) => /wwe\s+women'?s?\s+championship/i.test(t),
  },
  {
    slug: "world-heavyweight-championship",
    displayTitle: "World Heavyweight Championship",
    test: (t) => /world\s+heavyweight/i.test(t),
  },
  {
    slug: "womens-world-championship",
    displayTitle: "Women's World Championship",
    test: (t) =>
      /women'?s?\s+world\s+championship/i.test(t) || /women'?s?\s+world\s+champion/i.test(t),
  },
  {
    slug: "womens-ic-championship",
    displayTitle: "Women's IC Championship",
    test: (t) => /women'?s?\s+(intercontinental|\bic\b)/i.test(t),
  },
  {
    slug: "mens-ic-championship",
    displayTitle: "Men's IC Championship",
    test: (t) => /intercontinental|\bic\b/i.test(t),
  },
  {
    slug: "womens-us-championship",
    displayTitle: "Women's US Championship",
    test: (t) =>
      /women'?s?\s+united\s+states/i.test(t) || /women'?s?\s+u\.?s\.?\s+championship/i.test(t),
  },
  {
    slug: "mens-us-championship",
    displayTitle: "Men's US Championship",
    test: (t) => /united\s+states/i.test(t) || /\b(u\.?s\.|us)\s+championship/i.test(t),
  },
  {
    slug: "raw-tag-team-championship",
    displayTitle: "Raw Tag Team Championship",
    test: (t) => /raw\s+tag/i.test(t),
  },
  {
    slug: "smackdown-tag-team-championship",
    displayTitle: "SmackDown Tag Team Championship",
    test: (t) => /smackdown\s+tag/i.test(t),
  },
  {
    slug: "womens-tag-team-championship",
    displayTitle: "Women's Tag Team Championship",
    test: (t) => /women'?s?\s+tag/i.test(t),
  },
  // NXT (NXT 2.0) — more specific before broader NXT Championship
  {
    slug: "nxt-womens-north-american-championship",
    displayTitle: "NXT Women's North American Championship",
    test: (t) => /nxt\s+women'?s?\s+north\s+american/i.test(t),
  },
  {
    slug: "nxt-north-american-championship",
    displayTitle: "NXT North American Championship",
    test: (t) => /nxt\s+north\s+american/i.test(t) && !/women'?s?/i.test(t),
  },
  {
    slug: "nxt-womens-speed-championship",
    displayTitle: "NXT Women's Speed Championship",
    test: (t) =>
      /nxt\s+women'?s?\s+speed/i.test(t) ||
      /\bwomen'?s?\s+speed(\s+championship)?\b/i.test(t),
  },
  {
    slug: "nxt-mens-speed-championship",
    displayTitle: "NXT Men's Speed Championship",
    test: (t) =>
      /nxt\s+men'?s?\s+speed/i.test(t) || /\bmen'?s?\s+speed(\s+championship)?\b/i.test(t),
  },
  {
    slug: "nxt-tag-team-championship",
    displayTitle: "NXT Tag Team Championship",
    test: (t) => /nxt\s+tag/i.test(t),
  },
  {
    slug: "nxt-womens-championship",
    displayTitle: "NXT Women's Championship",
    test: (t) => /nxt\s+women'?s?\s+championship/i.test(t),
  },
  {
    slug: "nxt-championship",
    displayTitle: "NXT Championship",
    test: (t) => /\bnxt\s+championship\b/i.test(t) && !/women'?s?/i.test(t),
  },
];

const SLUG_ORDER = /** @type {readonly string[]} */ (
  PWBS_CHAMPIONSHIP_PAGES.map((p) => p.slug)
);

function normalizeApostrophes(s) {
  return String(s).replace(/[\u2018\u2019\u201B\u2032]/g, "'");
}

/**
 * @param {string | null | undefined} titleRaw
 * @returns {{ slug: string, displayTitle: string } | null}
 */
export function getPwbsChampionshipPage(titleRaw) {
  if (!titleRaw || typeof titleRaw !== "string") return null;
  const t = normalizeApostrophes(titleRaw)
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
  if (!t) return null;
  for (const p of PWBS_CHAMPIONSHIP_PAGES) {
    if (p.test(t)) return { slug: p.slug, displayTitle: p.displayTitle };
  }
  return null;
}

/**
 * Group key for reign timelines: same as PWBS slug when matched, else stable fallback.
 * @param {string | null | undefined} titleRaw
 * @returns {string}
 */
export function getPwbsReignGroupKey(titleRaw) {
  const page = getPwbsChampionshipPage(titleRaw);
  if (page) return page.slug;
  const t = normalizeApostrophes(String(titleRaw || ""))
    .trim()
    .toLowerCase();
  if (!t) return "";
  return t.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/**
 * @param {string} slug
 * @returns {string | null}
 */
export function getPwbsDisplayTitleForSlug(slug) {
  const s = String(slug || "").trim();
  const p = PWBS_CHAMPIONSHIP_PAGES.find((x) => x.slug === s);
  return p ? p.displayTitle : null;
}

/**
 * Sort order for championship index cards (matches lib/championshipDisplayOrder intent).
 * @param {string} slugA
 * @param {string} slugB
 * @returns {number}
 */
export function comparePwbsChampionshipSlugs(slugA, slugB) {
  const ia = SLUG_ORDER.indexOf(slugA);
  const ib = SLUG_ORDER.indexOf(slugB);
  const ha = ia === -1 ? 999 : ia;
  const hb = ib === -1 ? 999 : ib;
  if (ha !== hb) return ha - hb;
  return slugA.localeCompare(slugB, undefined, { sensitivity: "base" });
}
