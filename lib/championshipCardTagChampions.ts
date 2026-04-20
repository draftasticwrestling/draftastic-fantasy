import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import {
  getTagTeamMemberSlugs,
  isTagTeamTitle,
  parseTagTeamChampionToMemberSlugs,
} from "@/lib/scoring/tagTeamMembers.js";

export type CollapsedChampionsForCard = {
  champions: ChampionCardRow[];
  /** Moniker above member names; null when unknown (UI still reserves a row if hasTeamNameRow). */
  tagTeamName: string | null;
  /** Tag titles with 2+ champs: always reserve team-name band so cards align. */
  hasTeamNameRow: boolean;
};

export type ChampionCardRow = {
  champion: string;
  championSlug: string;
  wonDate: string;
  lostDate: string | null;
  imageUrl: string | null;
};

type WrestlerMini = { id: string; name: string | null; image_url: string | null };

type Lookup = {
  wrestlerBySlug: Map<string, WrestlerMini>;
  wrestlerByNameKey: Map<string, WrestlerMini>;
};

/** Replace team-name slugs in a parsed list with their member slugs (deduped). */
function flattenTeamSlugsInParsedList(slugs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of slugs) {
    const team = getTagTeamMemberSlugs(s);
    const isSingleMemberAlias = Boolean(team?.includes(s));
    if (team?.length && !isSingleMemberAlias) {
      for (const m of team) {
        if (!seen.has(m)) {
          seen.add(m);
          out.push(m);
        }
      }
    } else {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out;
}

function memberSlugsFromChampionRow(c: ChampionCardRow): string[] | null {
  const slugRaw = (c.championSlug || "").trim();
  const name = (c.champion || "").trim();
  const hyphenSlug = slugRaw.replace(/_/g, "-");
  const normSlug = hyphenSlug ? normalizeWrestlerName(hyphenSlug) : "";

  const fromMap =
    (normSlug && getTagTeamMemberSlugs(normSlug)) ||
    (name && getTagTeamMemberSlugs(normalizeWrestlerName(name)));

  const fromMapIsSingleMemberAlias = Boolean(normSlug && fromMap?.includes(normSlug));
  if (fromMap && fromMap.length >= 2 && !fromMapIsSingleMemberAlias) return [...fromMap];

  const parsed =
    parseTagTeamChampionToMemberSlugs(name) ||
    parseTagTeamChampionToMemberSlugs(slugRaw) ||
    parseTagTeamChampionToMemberSlugs(hyphenSlug);

  if (parsed && parsed.length >= 2) {
    const flat = flattenTeamSlugsInParsedList(parsed);
    return flat.length >= 2 ? flat : parsed;
  }

  return null;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function memberKeyFromSlugs(slugs: string[]): string {
  return [...new Set(slugs.map((s) => s.toLowerCase().trim()).filter(Boolean))].sort().join("|");
}

/** Known WWE team monikers when history only has member rows (e.g. SmackDown Tag). Keys = memberKeyFromSlugs([...]). */
const TAG_TEAM_MONIKER_BY_MEMBER_KEY: Record<string, string> = {
  "austin-theory|logan-paul": "The Vision",
  "damian-priest|r-truth": "Damian Priest & R-Truth",
  "jey-uso|jimmy-uso": "The Usos",
  "lash-legend|nia-jax": "The Irresistible Forces",
  "solo-sikoa|tama-tonga": "The MFTs",
};

function smartTitleToken(token: string): string {
  if (!token) return token;
  return token
    .split("-")
    .map((part) => {
      if (!part.length) return part;
      if (part.length === 1) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("-");
}

/**
 * Boxscore often stores team names all-lowercase or ALL CAPS. Preserve mixed-case strings from CMS.
 */
export function formatTagTeamDisplayLine(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const hasLetter = /[a-z]/i.test(trimmed);
  if (!hasLetter) return trimmed;
  const allLower = trimmed === trimmed.toLowerCase();
  const allUpper = trimmed === trimmed.toUpperCase();
  if (!allLower && !allUpper) return trimmed;

  return trimmed
    .split(/\s+[&＆]\s+/)
    .map((side) =>
      side
        .trim()
        .split(/\s+/)
        .map((w) => smartTitleToken(w))
        .join(" ")
    )
    .join(" & ");
}

function finalizeMoniker(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  return formatTagTeamDisplayLine(String(raw).trim());
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/**
 * Prefer a display name that is not "Wrestler A & Wrestler B" when reign rows include a team moniker.
 */
function inferTagTeamDisplayName(champs: ChampionCardRow[], memberSlugsOrdered: string[]): string | null {
  const setOrdered = new Set(memberSlugsOrdered);
  if (champs.length === 0 || setOrdered.size < 2) return null;

  const titleCaseFallbacks: string[] = [];

  for (const c of champs) {
    const slugRaw = (c.championSlug || "").trim();
    const hyphenSlug = slugRaw.replace(/_/g, "-");
    const normSlug = hyphenSlug ? normalizeWrestlerName(hyphenSlug) : "";
    const teamFromSlug = normSlug ? getTagTeamMemberSlugs(normSlug) : null;
    if (teamFromSlug && setsEqual(new Set(teamFromSlug), setOrdered)) {
      const label = (c.champion || "").trim();
      if (label && !/\s+[&＆]\s+/.test(label)) return finalizeMoniker(label);
      if (normSlug) titleCaseFallbacks.push(titleCaseSlug(normSlug));
      continue;
    }
    const members = memberSlugsFromChampionRow(c);
    if (members && setsEqual(new Set(members), setOrdered)) {
      const label = (c.champion || "").trim();
      if (label && !/\s+[&＆]\s+/.test(label)) return finalizeMoniker(label);
    }
  }

  return titleCaseFallbacks.length > 0 ? finalizeMoniker(titleCaseFallbacks[0]) : null;
}

/**
 * Current-champion cards: history often has one row for the team name and rows for each member
 * with the same won date. Merge those into one avatar + label per wrestler.
 */
export function collapseTagTeamChampionsForCard(
  title: string,
  champs: ChampionCardRow[],
  lookup: Lookup
): CollapsedChampionsForCard {
  if (!isTagTeamTitle(title) || champs.length === 0) {
    return { champions: champs, tagTeamName: null, hasTeamNameRow: false };
  }

  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const c of champs) {
    const members = memberSlugsFromChampionRow(c);
    if (members) {
      for (const m of members) {
        if (!seen.has(m)) {
          seen.add(m);
          ordered.push(m);
        }
      }
    }
  }

  if (ordered.length >= 2) {
    const wonDate = champs[0].wonDate;
    const lostDate = champs[0].lostDate;
    const mKey = memberKeyFromSlugs(ordered);
    const monikerFromMembers = TAG_TEAM_MONIKER_BY_MEMBER_KEY[mKey];
    const inferred = inferTagTeamDisplayName(champs, ordered);
    const tagTeamName = inferred ?? finalizeMoniker(monikerFromMembers ?? "");
    const champions = ordered.map((memberSlug) => {
      const w = lookup.wrestlerBySlug.get(memberSlug) ?? lookup.wrestlerByNameKey.get(memberSlug);
      return {
        champion: w?.name ?? titleCaseSlug(memberSlug),
        championSlug: memberSlug,
        wonDate,
        lostDate,
        imageUrl: w?.image_url ?? null,
      };
    });
    return { champions, tagTeamName, hasTeamNameRow: true };
  }

  // Separate history rows per wrestler (e.g. R-Truth + Damian Priest), no team row
  const singles: ChampionCardRow[] = [];
  const seenSingle = new Set<string>();
  for (const c of champs) {
    const slug =
      normalizeWrestlerName(String(c.championSlug || "").replace(/_/g, "-")) ||
      normalizeWrestlerName(String(c.champion || ""));
    if (!slug) continue;
    const teamExpand = getTagTeamMemberSlugs(slug);
    const isSingleMemberAlias = Boolean(teamExpand?.includes(slug));
    if (teamExpand && teamExpand.length >= 2 && !isSingleMemberAlias) continue;
    if (seenSingle.has(slug)) continue;
    seenSingle.add(slug);
    const w = lookup.wrestlerBySlug.get(slug) ?? lookup.wrestlerByNameKey.get(slug);
    singles.push({
      champion: w?.name ?? c.champion,
      championSlug: slug,
      wonDate: c.wonDate,
      lostDate: c.lostDate,
      imageUrl: w?.image_url ?? c.imageUrl,
    });
  }

  if (singles.length >= 2) {
    const slugs = singles.map((s) => s.championSlug);
    const mKey = memberKeyFromSlugs(slugs);
    const monikerFromMembers = TAG_TEAM_MONIKER_BY_MEMBER_KEY[mKey];
    const inferred = inferTagTeamDisplayName(singles, slugs);
    const tagTeamName = inferred ?? finalizeMoniker(monikerFromMembers ?? "");
    return { champions: singles, tagTeamName, hasTeamNameRow: true };
  }

  if (singles.length > 0) {
    return { champions: singles, tagTeamName: null, hasTeamNameRow: false };
  }

  return { champions: champs, tagTeamName: null, hasTeamNameRow: champs.length >= 2 };
}
