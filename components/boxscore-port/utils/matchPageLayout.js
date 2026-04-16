/**
 * Match page layout helpers: headline text (not championship "None") and
 * which match types get the full-image hero on the dedicated match page.
 */

/**
 * Build a single "A vs B vs …" string from match.participants whether stored as
 * a string (normal) or an array (some JSON / legacy payloads).
 */
export function normalizeParticipantsToVersusString(match) {
  const p = match?.participants;
  if (p == null || p === "") return "";
  if (typeof p === "string") return p.trim();
  if (Array.isArray(p)) {
    const sides = p
      .map((side) => {
        if (typeof side === "string") return side.trim();
        if (Array.isArray(side)) {
          return side
            .filter(Boolean)
            .map((s) => String(s).trim())
            .join(" & ");
        }
        if (side && typeof side === "object") {
          const slugs = side.slugs || side.participants;
          if (Array.isArray(slugs)) {
            const joined = slugs
              .filter(Boolean)
              .map((s) => String(s).trim())
              .join(" & ");
            const name = (side.name || side.teamName || "").trim();
            return name ? `${name} (${joined})` : joined;
          }
        }
        return "";
      })
      .filter(Boolean);
    return sides.join(" vs ");
  }
  return String(p).trim();
}

/** Split "a & b" or "a and b" (display text or slugs) into teammate slots */
function splitTeamMemberTokens(inner) {
  return inner
    .split(/\s*(?:&|(?:\band\b))\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseTeamStringForPage(teamStr, wrestlerMap = {}) {
  if (!teamStr) {
    return { teamName: "", slugs: [] };
  }
  const teamMatch = teamStr.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (teamMatch) {
    const teamName = teamMatch[1].trim();
    const potentialSlugs = splitTeamMemberTokens(teamMatch[2]);
    const slugs = potentialSlugs.map((potentialSlug) => {
      if (wrestlerMap[potentialSlug]) return potentialSlug;
      const found = Object.values(wrestlerMap).find((w) => w.name === potentialSlug || w.id === potentialSlug);
      return found ? found.id : potentialSlug;
    });
    return { teamName, slugs };
  }
  const potentialSlugs = splitTeamMemberTokens(teamStr);
  const slugs = potentialSlugs.map((potentialSlug) => {
    if (wrestlerMap[potentialSlug]) return potentialSlug;
    const found = Object.values(wrestlerMap).find((w) => w.name === potentialSlug || w.id === potentialSlug);
    return found ? found.id : potentialSlug;
  });
  return { teamName: "", slugs };
}

function normalize(str) {
  return (str || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Simultaneous multi-way matches should use " vs " between sides. Some rows
 * mistakenly use " → " (gauntlet-style); split those so 5-way ladder etc. parse correctly.
 */
function shouldTreatArrowAsVersusForMultiWay(match) {
  const t = match?.matchType;
  return (
    t === "Triple Threat match" ||
    t === "Fatal Four-way match" ||
    t === "5-way Match" ||
    (typeof t === "string" && /^\d+-way Match$/i.test(t)) ||
    t === "3-way Tag Team" ||
    t === "4-way Tag Team"
  );
}

/** Split participant string into sides: prefer " vs ", else "→" for simultaneous multi-way only. */
function splitIntoVersusSides(match, raw) {
  if (!raw || typeof raw !== "string") return [];
  let parts = raw
    .split(/\s+vs\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 1 && parts[0].includes("→") && match && shouldTreatArrowAsVersusForMultiWay(match)) {
    parts = parts[0]
      .split(/\s*→\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return parts;
}

/** Sides from "A vs B vs C" string (not gauntlet arrows). */
export function getVersusTeamStrings(match) {
  if (!match) return null;
  if (match.matchType === "Gauntlet Match" || match.matchType === "Tag Team Gauntlet Match" || match.matchType === "2 out of 3 Falls") {
    return null;
  }
  const raw = normalizeParticipantsToVersusString(match);
  if (!raw) return null;
  const parts = splitIntoVersusSides(match, raw);
  return parts.length > 0 ? parts : null;
}

/**
 * Split participants into sides for event cards and layouts (MatchCard, etc.).
 * Uses the same rules as getVersusTeamStrings, plus gauntlet arrows and 2-out-of-3.
 */
export function getSidesFromMatchParticipants(match) {
  if (!match || match.participants == null) return [];
  const p = match.participants;

  if (match.matchType === "Gauntlet Match" || match.matchType === "Tag Team Gauntlet Match") {
    if (typeof p === "string") {
      if (p.includes(" → ")) return p.split(" → ").map((s) => s.trim()).filter(Boolean);
      if (p.includes("→")) return p.split("→").map((s) => s.trim()).filter(Boolean);
      return p.split(/\s+vs\s+/i).map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }
  if (match.matchType === "2 out of 3 Falls" && typeof p === "string") {
    return p.split(/\s+vs\s+/i).map((s) => s.trim()).filter(Boolean);
  }

  const versus = getVersusTeamStrings(match);
  if (versus && versus.length > 0) return versus;

  if (typeof p === "string") {
    return splitIntoVersusSides(match, p.trim());
  }
  if (Array.isArray(p)) {
    const normalized = normalizeParticipantsToVersusString(match);
    if (!normalized) return p.filter((x) => typeof x === "string" && x.trim());
    return splitIntoVersusSides(match, normalized);
  }
  return [];
}

/** Dedicated multi-team tag grid (compact card) — includes mis-tagged Fatal Four-way when all sides are tag pairs. */
export function shouldUseDedicatedMultiTeamTagCard(match, sideStrings, wrestlerMap = {}) {
  const t = match?.matchType;
  if (["6-team Tag Team", "5-team Tag Team", "4-way Tag Team", "3-way Tag Team"].includes(t)) {
    return Array.isArray(sideStrings) && sideStrings.length > 0;
  }
  if (!sideStrings || sideStrings.length < 3) return false;
  if (t === "Fatal Four-way match" && sideStrings.length === 4) {
    return sideStrings.every((s) => parseTeamStringForPage(s, wrestlerMap).slugs.length === 2);
  }
  if (t === "Triple Threat match" && sideStrings.length === 3) {
    return sideStrings.every((s) => parseTeamStringForPage(s, wrestlerMap).slugs.length === 2);
  }
  return false;
}

/** Four tag teams at once (2×2 grid), not a single horizontal "gauntlet" strip */
export function isFourWayTagTeamGrid(sides) {
  return Array.isArray(sides) && sides.length === 4 && sides.every((s) => (s?.slugs?.length ?? 0) === 2);
}

/** Three tag teams at once */
export function isThreeWayTagTeamGrid(sides) {
  return Array.isArray(sides) && sides.length === 3 && sides.every((s) => (s?.slugs?.length ?? 0) === 2);
}

/**
 * Use 2×2 / 1×3 grid when structure or booking label says multi-team tag,
 * even if slug parsing is imperfect (e.g. "A and B" vs "A & B").
 */
export function shouldUseTagTeamMultiGrid(match, teamStrings, sides) {
  const stip =
    match?.stipulation === "Custom/Other" && (match?.customStipulation || "").trim()
      ? match.customStipulation.trim()
      : match?.stipulation || "";
  const fourLabel = match?.matchType === "4-way Tag Team" || stip === "4-way Tag Team";
  const threeLabel = match?.matchType === "3-way Tag Team" || stip === "3-way Tag Team";
  if (fourLabel && Array.isArray(teamStrings) && teamStrings.length === 4) return "2x2";
  if (threeLabel && Array.isArray(teamStrings) && teamStrings.length === 3) return "1x3";
  if (isFourWayTagTeamGrid(sides)) return "2x2";
  if (isThreeWayTagTeamGrid(sides)) return "1x3";
  return null;
}

/**
 * Winner side index for multi-way / tag strings (same idea as MatchCard).
 */
export function getWinnerSideIndex(teamStrings, match, wrestlerMap) {
  const winner =
    match.result && match.result.includes(" def. ")
      ? match.result.split(" def. ")[0]
      : match.result || "";
  let winnerIndex = -1;
  teamStrings.forEach((teamStr, idx) => {
    const { teamName, slugs } = parseTeamStringForPage(teamStr, wrestlerMap);
    const individualNames = slugs.map((slug) => wrestlerMap[slug]?.name || slug).join(" & ");
    if (teamName && normalize(winner) === normalize(teamName)) winnerIndex = idx;
    else if (normalize(winner) === normalize(individualNames)) winnerIndex = idx;
    else if (normalize(winner) === normalize(teamStr)) winnerIndex = idx;
  });
  return winnerIndex;
}

const ENHANCED_TYPES = new Set([
  "Singles Match",
  "Tag Team",
  "Triple Threat match",
  "Fatal Four-way match",
  "5-way Match",
  "3-way Tag Team",
  "4-way Tag Team",
  "6-person Tag Team",
]);

/** Beyond this many competitors, the full-image hero + per-wrestler stats are too heavy — use event-style MatchCard on the dedicated page. */
const MAX_WRESTLERS_FOR_ENHANCED_MATCH_PAGE = 5;

/**
 * Full-image hero for singles, tag, triple threat, fatal four-way, and 6-person tag (3 vs 3).
 * String participants only; validates slug counts per match type.
 */
export function shouldUseEnhancedMatchPage(match, wrestlerMap = {}) {
  if (!match || !ENHANCED_TYPES.has(match.matchType)) return false;
  const teamStrings = getSidesFromMatchParticipants(match);
  if (!teamStrings || teamStrings.length < 2) return false;
  const sides = teamStrings.map((ts) => parseTeamStringForPage(ts, wrestlerMap));
  const totalSlugs = sides.reduce((sum, s) => sum + (s.slugs?.length ?? 0), 0);
  if (totalSlugs > MAX_WRESTLERS_FOR_ENHANCED_MATCH_PAGE) return false;
  const mt = match.matchType;
  if (mt === "Singles Match") {
    return teamStrings.length === 2 && sides.every((s) => s.slugs.length === 1);
  }
  if (mt === "Tag Team") {
    return teamStrings.length === 2 && sides.every((s) => s.slugs.length === 2);
  }
  if (mt === "Triple Threat match") {
    return teamStrings.length === 3 && sides.every((s) => s.slugs.length === 1);
  }
  if (mt === "Fatal Four-way match") {
    const allSingles = sides.every((s) => s.slugs.length === 1);
    return allSingles && (teamStrings.length === 4 || teamStrings.length === 5);
  }
  if (mt === "5-way Match") {
    return teamStrings.length === 5 && sides.every((s) => s.slugs.length === 1);
  }
  if (mt === "3-way Tag Team") {
    return teamStrings.length === 3 && sides.every((s) => s.slugs.length === 2);
  }
  if (mt === "4-way Tag Team") {
    return teamStrings.length === 4 && sides.every((s) => s.slugs.length === 2);
  }
  if (mt === "6-person Tag Team") {
    return teamStrings.length === 2 && sides.every((s) => s.slugs.length === 3);
  }
  return false;
}

/** Human-readable page title — never uses championship "None" as the main headline. */
export function buildMatchPageHeadline(match) {
  let headlineMatchType = match.matchType;
  if (headlineMatchType === "Fatal Four-way match") {
    const sideCount = getSidesFromMatchParticipants(match).length;
    if (sideCount === 5) headlineMatchType = "5-way Match";
  }
  const stip =
    match.stipulation === "Custom/Other" && (match.customStipulation || "").trim()
      ? match.customStipulation.trim()
      : match.stipulation && match.stipulation !== "None"
        ? match.stipulation
        : "";
  const parts = [];
  if (headlineMatchType && headlineMatchType !== "Promo") parts.push(headlineMatchType);
  if (stip) parts.push(stip);
  if (match.title && match.title !== "None") parts.push(`for the ${match.title}`);
  if (parts.length === 0) {
    return match.eventName ? `Match — ${match.eventName}` : "Match";
  }
  return parts.join(" — ");
}

