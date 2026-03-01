import { logger } from "../utils/logger.js";
import {
  EVENT_TYPES,
  getPLECategory,
} from "../parsers/eventClassifier.js";
import {
  isMainEvent,
  isBattleRoyal,
  isTitleMatch,
  isTitleChange,
  isTitleDefense,
  getMatchType,
} from "../extractors/matches.js";
import {
  extractMatchParticipants,
  normalizeWrestlerName as slugifyName,
} from "../parsers/participantParser.js";

function isDQ(match) {
  const method = (match.method || "").toLowerCase();
  return method.includes("dq") || method.includes("disqualification");
}

function isNoContest(match) {
  const method = (match.method || "").toLowerCase();
  return method.includes("no contest");
}

/** Build a single searchable string from all string-like match fields so we can detect KOTR even when stipulation is in a different key. */
function getMatchTextForKOTR(match) {
  if (!match || typeof match !== "object") return "";
  const parts = [];
  const skipKeys = new Set(["participants", "result", "method", "order", "wrestlerPoints", "warGamesData", "war_games_data"]);
  for (const key of Object.keys(match)) {
    if (skipKeys.has(key)) continue;
    const v = match[key];
    if (v == null) continue;
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
    else if (Array.isArray(v)) parts.push(v.map((x) => (typeof x === "string" ? x : String(x))).join(" "));
    else if (typeof v === "object" && (key === "stipulation" || key === "Stipulation" || key === "title" || key === "round")) {
      parts.push(String(v));
    }
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Known R/S events where KOTR semis have no stipulation text in the DB.
 * We identify the two semi matches by participant names (so array order doesn't matter).
 * Each entry: { bracket, requiredSubstrings } — match participants string must contain ALL substrings.
 */
const KNOWN_KOTR_SEMI_EVENT_IDS = ["smackdown-20250620", "smackdown-20260620"];

const KNOWN_KOTR_SEMI_BY_PARTICIPANTS = {
  "smackdown-20250620": [
    { bracket: "king", requiredSubstrings: ["randy", "sami"] },
    { bracket: "queen", requiredSubstrings: ["asuka", "alexa"] },
  ],
  "smackdown-20260620": [
    { bracket: "king", requiredSubstrings: ["randy", "sami"] },
    { bracket: "queen", requiredSubstrings: ["asuka", "alexa"] },
  ],
};

function getMatchParticipantsStr(match) {
  const rawParts = match.participants;
  const str =
    typeof rawParts === "string"
      ? rawParts
      : Array.isArray(rawParts)
        ? (rawParts || [])
            .map((p) =>
              typeof p === "string" ? p : (p && (p.name ?? p.slug ?? p.displayName ?? p.id)) ? String(p.name ?? p.slug ?? p.displayName ?? p.id) : ""
            )
            .join(" ")
        : "";
  return str.toLowerCase();
}

/** If this match is a known KOTR semi (event id + participants match), return { round: "semi", bracket: "king"|"queen" }. */
function getKnownKOTRSemiSlot(match, allMatches, event) {
  if (!event?.id || !allMatches?.length) return null;
  const eventId = String(event.id || "").toLowerCase();
  const configKey = KNOWN_KOTR_SEMI_EVENT_IDS.find((id) => eventId.includes(id));
  if (!configKey || !KNOWN_KOTR_SEMI_BY_PARTICIPANTS[configKey]) return null;
  const participantsStr = getMatchParticipantsStr(match);
  if (!participantsStr) return null;
  const definitions = KNOWN_KOTR_SEMI_BY_PARTICIPANTS[configKey];
  for (const def of definitions) {
    const allPresent = (def.requiredSubstrings || []).every((sub) => participantsStr.includes(sub.toLowerCase()));
    if (allPresent) return { round: "semi", bracket: def.bracket };
  }
  return null;
}

/** True if match is part of King of the Ring / Queen of the Ring tournament. */
function isKingOfTheRingMatch(match) {
  const combined = getMatchTextForKOTR(match);
  // Elimination Chamber qualifiers are regular matches, not KOTR/QOTR.
  if (combined.includes("elimination chamber")) return false;
  if (
    combined.includes("king of the ring") ||
    combined.includes("queen of the ring") ||
    combined.includes("kotr") ||
    combined.includes("qotr") ||
    combined.includes("king & queen") ||
    combined.includes("king and queen")
  )
    return true;
  if ((combined.includes("qualifier") || combined.includes("semi") || combined.includes("first round")) &&
      (combined.includes("ring") || combined.includes("king") || combined.includes("queen") || combined.includes("women")))
    return true;
  return false;
}

/** True if match is Queen of the Ring (women's bracket). Strict: only explicit tournament matches to avoid wrong points (6, 43, extra participants). */
function isQueenOfTheRingMatch(match) {
  const combined = getMatchTextForKOTR(match);
  if (combined.includes("elimination chamber")) return false;
  if (combined.includes("queen of the ring") || combined.includes("qotr")) return true;
  if (combined.includes("king and queen") || combined.includes("king & queen")) return true;
  if (combined.includes("women") && (combined.includes("qualifier") || combined.includes("semi") || combined.includes("final") || combined.includes("first round")) && combined.includes("ring")) return true;
  if (combined.includes("women") && (combined.includes("semi") || combined.includes("semifinal"))) return true;
  return false;
}

/** True if wrestler is a known woman — used so we never assign "king" bracket to women (they go to queen or no KOTR). */
function isKnownWoman(wrestlerName) {
  if (!wrestlerName || typeof wrestlerName !== "string") return false;
  const slug = (slugifyName(wrestlerName) || wrestlerName.toLowerCase()).replace(/-/g, " ");
  const known = [
    "becky", "lynch", "giulia", "naomi", "nattie", "natalya", "zelina", "vega", "zoey", "stark",
    "asuka", "alexa", "bliss", "jade", "roxanne", "perez", "cargill", "bayley", "bianca", "charlotte",
    "rhea", "liv", "shotzi", "michin", "alba", "fyre", "candice", "lerae", "piper", "niven",
    "raquel", "rodriguez",
  ];
  return known.some((t) => slug.includes(t));
}

/**
 * Round of King of the Ring: "first" | "semi" | "final".
 * Uses match type, stipulation, title, round/stage; else treats main-event or last KOTR match as final.
 * On Raw/SmackDown the tournament final is at NOC, so we never infer "final" from main event or order.
 * @param {Object} [event] - Event with classifiedType; when Raw/SmackDown, main/order fallbacks are skipped.
 */
function getKingOfTheRingRound(match, allMatches, event) {
  const combined = getMatchTextForKOTR(match);
  if (combined.includes("final") && !combined.includes("semi")) return "final";
  // Semi: e.g. "King of the Ring Semi-Final" (stipulation), semi-final, semifinal, semifinals
  if (combined.includes("semi-final") || combined.includes("semi final") || /\bsemi\b/.test(combined) || combined.includes("semifinal")) return "semi";
  if (combined.includes("first round") || combined.includes("quarter") || combined.includes("qualifier")) return "first";
  const isRS = event && (event.classifiedType === EVENT_TYPES.RAW || event.classifiedType === EVENT_TYPES.SMACKDOWN);
  if (isRS) return "first"; // On R/S only text can give "final"; never infer from main/order (final is at NOC).
  const isMain = allMatches && isMainEvent(match, allMatches, false);
  if (isMain && isKingOfTheRingMatch(match)) return "final";
  if (allMatches && allMatches.length > 0 && isKingOfTheRingMatch(match)) {
    const kotrMatches = allMatches.filter((m) => isKingOfTheRingMatch(m));
    const maxOrder = Math.max(...kotrMatches.map((m) => m.order ?? 0));
    if ((match.order ?? 0) >= maxOrder) return "final";
  }
  return "first";
}

/** Match display name or slug to another (e.g. "Bron Breakker" to "bron-breakker"). */
function nameMatches(a, b) {
  if (!a || !b) return false;
  const x = String(a).trim().toLowerCase();
  const y = String(b).trim().toLowerCase();
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const xSlug = slugifyName(a);
  const ySlug = slugifyName(b);
  return (xSlug && ySlug && (xSlug === ySlug || xSlug.includes(ySlug) || ySlug.includes(xSlug)));
}

/** Normalize War Games data from match (camelCase or snake_case from DB). */
function getWarGamesData(match) {
  return match.warGamesData || match.war_games_data || null;
}

/**
 * War Games: wrestler who made the pin.
 * Uses match.warGamesData from Boxscore (pinSubmissionWinner = slug, pinWinnerName = name).
 * Fallback: match.pinfallWinner / result/method parsing.
 * Returns slug or name string for comparison with wrestlerName.
 */
function getWarGamesPinfallWinner(match) {
  const wg = getWarGamesData(match);
  if (wg) {
    const slug = wg.pinSubmissionWinner ?? wg.pin_submission_winner;
    const name = wg.pinWinnerName ?? wg.pin_winner_name;
    if (slug && typeof slug === "string" && slug.trim()) return slug.trim();
    if (name && typeof name === "string" && name.trim()) return name.trim();
  }
  const pw = match.pinfallWinner || match.pinfall_winner;
  if (pw && typeof pw === "string" && pw.trim()) return pw.trim();
  const result = match.result || "";
  const method = match.method || "";
  const combined = `${result} ${method}`;
  const byMatch = combined.match(/(?:pinfall|submission|pin|sub)\s+by\s*[:–-]?\s*([^·\[(\n]+?)(?:\s*[·\[(\n]|$)/i) || combined.match(/(?:by)\s+([^·\[(\n]+?)(?:\s*[·\[(\n]|$)/i);
  if (byMatch && byMatch[1]) return byMatch[1].trim();
  const pinnedBy = combined.match(/(.+?)\s+pinned\s+/i);
  if (pinnedBy && pinnedBy[1]) return pinnedBy[1].trim();
  return null;
}

/**
 * Parse "Entry Order: Name1 → Name2 → ..." from match.result into array of names in order.
 * Returns array of trimmed strings or empty array.
 */
function parseEntryOrderFromResult(resultStr) {
  if (!resultStr || typeof resultStr !== "string") return [];
  const m = resultStr.match(/Entry\s+Order\s*:\s*([^\])]+)/i);
  if (!m || !m[1]) return [];
  return m[1]
    .split(/\s*→\s*|\s+->\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * War Games entry order is per team: 1st on team = 5 pts, 2nd = 4, 3rd = 3, 4th = 2, 5th = 1.
 * Bron (1st for his team) = 5; CM Punk (1st for his team) = 5.
 * Prefer match.warGamesData: entryOrder has { entryNumber (global 1–10), wrestler, team } — use position within team.
 * Fallback: match.result "Entry Order: ..." or flat array (first 5 = team1 order, next 5 = team2 order).
 */
function getWarGamesEntryPoints(match, wrestlerName) {
  const wg = getWarGamesData(match);
  const entryOrderFromData = wg?.entryOrder ?? wg?.entry_order;
  if (Array.isArray(entryOrderFromData) && entryOrderFromData.length > 0) {
    const name = (wrestlerName || "").trim().toLowerCase();
    const nameSlug = slugifyName(wrestlerName);
    const entry = entryOrderFromData.find((e) => {
      const slug = (e.wrestler ?? e.slug ?? "").trim().toLowerCase();
      if (!slug) return false;
      return slug === name || slug === nameSlug || slug.includes(name) || name.includes(slug) || (nameSlug && (slug === nameSlug || slug.includes(nameSlug) || nameSlug.includes(slug)));
    });
    if (!entry) return 0;
    const team = entry.team ?? entry.teamNumber;
    const globalNum = Math.max(1, Math.min(10, Number(entry.entryNumber ?? entry.entry_number) || 0));
    const hasTeam = team !== undefined && team !== null && team !== "";
    const sameTeam = hasTeam
      ? entryOrderFromData.filter(
          (e) => (e.team ?? e.teamNumber) === team && (e.wrestler ?? e.slug)
        )
      : [];
    if (sameTeam.length > 0) {
      sameTeam.sort((a, b) => (a.entryNumber ?? a.entry_number ?? 0) - (b.entryNumber ?? b.entry_number ?? 0));
      const positionOnTeam = sameTeam.findIndex((e) => {
        const s = (e.wrestler ?? e.slug ?? "").trim().toLowerCase();
        return s && (s === nameSlug || s === name || nameMatches(e.wrestler ?? e.slug, wrestlerName));
      });
      if (positionOnTeam >= 0 && positionOnTeam <= 4) return 5 - positionOnTeam;
    }
    return 5 - ((globalNum - 1) % 5);
  }
  const fromResult = parseEntryOrderFromResult(match.result);
  if (fromResult.length >= 10) {
    const index = fromResult.findIndex((entryName) => nameMatches(entryName, wrestlerName));
    if (index < 0) return 0;
    const positionOnTeam = index % 5;
    return 5 - positionOnTeam;
  }
  if (fromResult.length > 0) {
    const index = fromResult.findIndex((entryName) => nameMatches(entryName, wrestlerName));
    if (index >= 0) return 5 - (index % 5);
    return 0;
  }
  const order = match.warGamesEntryOrder || match.war_games_entry_order;
  if (!Array.isArray(order) || order.length === 0) return 0;
  const name = (wrestlerName || "").trim().toLowerCase();
  const nameSlug = slugifyName(wrestlerName);
  let index = -1;
  for (let i = 0; i < order.length; i++) {
    const entry = order[i];
    const entryName = (typeof entry === "string" ? entry : entry?.name ?? entry?.wrestler ?? "").trim().toLowerCase();
    const entrySlug = typeof entry === "object" && entry ? slugifyName(entry.wrestler ?? entry.name) : slugifyName(entry);
    if (!entryName && !entrySlug) continue;
    if (entryName === name || entrySlug === nameSlug || entryName.includes(name) || name.includes(entryName) || (nameSlug && entrySlug && (entrySlug === nameSlug || entrySlug.includes(nameSlug) || nameSlug.includes(entrySlug)))) {
      index = i;
      break;
    }
  }
  if (index < 0) return 0;
  return 5 - (index % 5);
}

/** Normalize a name/slug for Royal Rumble lookup (consistent with participantParser). Apostrophes unified so "Je'Von" matches. */
function rrSlug(s) {
  if (s == null || typeof s !== "string") return "";
  const t = String(s)
    .replace(/[\u2018\u2019\u201A\u201B\u2032']/g, "")
    .trim();
  return slugifyName(t);
}

/** Return true if name/slug a matches b (either direction). */
function rrNameMatches(a, b) {
  const sa = rrSlug(a);
  const sb = rrSlug(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  if (sa.includes(sb) || sb.includes(sa)) return true;
  return false;
}

/**
 * Parse Royal Rumble match data for scoring.
 * Expects match.royalRumbleData (or royal_rumble_data) with:
 *   - eliminations: Array<{ eliminatedBy, eliminated } | { eliminator, eliminated }>
 *   - entryOrder: Array<{ entryNumber | entry_number, wrestler }>
 *   - timeInRingMinutes: optional Record<slug, number> for Iron Man
 * Returns stats for the given wrestlerName: eliminatorCountForWrestler, isIronMan, isMostEliminations.
 */
/**
 * Get Iron Man/Woman name from statistics (string or object from Boxscore).
 * For object: returns one name. For string: returns first match (Iron Man or Iron Woman).
 */
function getIronManFromStatistics(statistics) {
  if (!statistics) return null;
  if (typeof statistics === "object" && !Array.isArray(statistics)) {
    const name =
      statistics.ironMan ??
      statistics.ironManWrestler ??
      statistics.ironWoman ??
      statistics.iron_woman ??
      statistics.iron_man ??
      statistics.iron_man_wrestler ??
      statistics.ironManName ??
      statistics.ironWomanName;
    if (name) return typeof name === "string" ? name.trim() : String(name).trim();
  }
  if (typeof statistics !== "string") return null;
  const pair = getIronManAndWomanFromText(statistics);
  return pair.ironManName ?? pair.ironWomanName ?? null;
}

/**
 * Parse both "Iron Man: X" and "Iron Woman: Y" from one text (event-level stats).
 * Uses \b so "Iron Man" doesn't match inside "Iron Woman".
 */
function getIronManAndWomanFromText(text) {
  const out = { ironManName: null, ironWomanName: null };
  if (!text || typeof text !== "string") return out;
  const normalized = text.replace(/\s+/g, " ").trim();
  const combined = normalized.match(/Iron\s*man\/?\s*Iron\s*woman[:\s]+([^-]+?)(?:\s*-\s*[\d:]+)?/i);
  if (combined) out.ironWomanName = combined[1].trim();
  const ironWoman = normalized.match(/Iron\s*woman\b[:\s]+([^-]+?)(?:\s*-\s*[\d:]+)?/i);
  if (ironWoman) out.ironWomanName = ironWoman[1].trim();
  const ironMan = normalized.match(/Iron\s*man\b[:\s]+([^-]+?)(?:\s*-\s*[\d:]+)?/i);
  if (ironMan) out.ironManName = ironMan[1].trim();
  return out;
}

/** Collect all string values from an object (one level deep + one more for nested objects). Includes array elements. */
function getAllStringValues(obj, depth = 0) {
  const out = [];
  if (depth > 2 || !obj || typeof obj !== "object") return out;
  for (const value of Object.values(obj)) {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") out.push(item);
        else if (item && typeof item === "object") out.push(...getAllStringValues(item, depth + 1));
      }
    } else if (value && typeof value === "object") {
      out.push(...getAllStringValues(value, depth + 1));
    }
  }
  return out;
}

/**
 * Get Most Eliminations name(s) from statistics (string or object from Boxscore).
 */
function getMostEliminationsFromStatistics(statistics) {
  if (!statistics) return null;
  if (typeof statistics === "object" && !Array.isArray(statistics)) {
    const name =
      statistics.mostEliminations ??
      statistics.mostEliminationsWrestler ??
      statistics.most_eliminations_wrestler ??
      statistics.mostEliminationsName;
    if (name) return typeof name === "string" ? name.trim() : String(name).trim();
  }
  if (typeof statistics !== "string") return null;
  const normalized = statistics.replace(/\s+/g, " ").trim();
  const m = normalized.match(
    /Most\s+Eliminations[:\s]+([^-]+?)(?:\s*-\s*\d+)?/i
  );
  if (m) return m[1].trim() || null;
  return null;
}

function getRoyalRumbleStats(match, wrestlerName, event) {
  const out = {
    eliminatorCountForWrestler: 0,
    isIronMan: false,
    isMostEliminations: false,
  };
  const rr = match?.royalRumbleData ?? match?.royal_rumble_data;
  const rrObj = rr && typeof rr === "object" ? rr : {};

  const matchData = extractMatchParticipants(match);
  const participants = matchData.participantsForScoring ?? matchData.participants ?? [];
  const winnerName = matchData.winners?.[0] ?? null;
  const winnerSlug = winnerName ? rrSlug(winnerName) : null;

  const eliminatorCount = /** @type {Record<string, number>} */ ({});
  const eliminatedOrder = /** @type {string[]} */ ([]);

  const rawEliminations = rrObj.eliminations ?? rrObj.elimination ?? [];
  if (Array.isArray(rawEliminations)) {
    for (const row of rawEliminations) {
      const eliminator = (row.eliminatedBy ?? row.eliminator ?? "").toString().trim();
      const eliminated = (row.eliminated ?? "").toString().trim();
      if (!eliminator || !eliminated) continue;
      const eliminatorS = rrSlug(eliminator);
      const eliminatedS = rrSlug(eliminated);
      if (eliminatorS) {
        eliminatorCount[eliminatorS] = (eliminatorCount[eliminatorS] ?? 0) + 1;
      }
      eliminatedOrder.push(eliminatedS || eliminated);
    }
  }

  const entryNumberBySlug = /** @type {Record<string, number>} */ ({});
  const entryOrder = rrObj.entryOrder ?? rrObj.entry_order ?? [];
  if (Array.isArray(entryOrder)) {
    for (const e of entryOrder) {
      const num = Number(e.entryNumber ?? e.entry_number ?? 0);
      const w = (e.wrestler ?? e.name ?? e.slug ?? "").toString().trim();
      if (num >= 1 && w) entryNumberBySlug[rrSlug(w)] = num;
    }
  }

  /** Parse "59:49" or "1:05:00" to minutes. */
  function parseTimeInRingToMinutes(s) {
    if (s == null || typeof s !== "string") return 0;
    const parts = s.trim().split(":").map((p) => parseInt(p, 10));
    if (parts.length === 2 && !parts.some(Number.isNaN)) return parts[0] + parts[1] / 60;
    if (parts.length === 3 && !parts.some(Number.isNaN)) return parts[0] * 60 + parts[1] + parts[2] / 60;
    return 0;
  }

  let ironManSlug = null;

  // Iron Man from entryOrder[].timeInRing (Supabase: each entry has slug + timeInRing "59:49")
  if (Array.isArray(entryOrder) && entryOrder.length > 0) {
    let maxMinutes = -1;
    for (const e of entryOrder) {
      const slug = (e.slug ?? e.wrestler ?? e.name ?? "").toString().trim();
      if (!slug) continue;
      const timeStr = (e.timeInRing ?? e.time_in_ring ?? "").toString().trim();
      const minutes = parseTimeInRingToMinutes(timeStr);
      if (minutes > maxMinutes) {
        maxMinutes = minutes;
        ironManSlug = rrSlug(slug) || slug;
      }
    }
  }

  // Iron Man: (1) match root, (2) royalRumbleData explicit, (3) statistics text (Boxscore UI)
  if (!ironManSlug) {
  const ironManFromMatch =
    match.ironMan ??
    match.ironManWrestler ??
    match.royalRumbleIronMan ??
    match.iron_man ??
    match.iron_man_wrestler ??
    match.ironWoman ??
    match.iron_woman;
  const ironManExplicit =
    ironManFromMatch ??
    rrObj.ironManWrestler ??
    rrObj.iron_man_wrestler ??
    rrObj.ironMan ??
    rrObj.ironWoman ??
    rrObj.iron_man ??
    rrObj.iron_woman ??
    rrObj.ironManName ??
    rrObj.ironManWrestlerName ??
    rrObj.ironWomanName;
  if (ironManExplicit) {
    const nameOrSlug = (typeof ironManExplicit === "string" ? ironManExplicit : String(ironManExplicit)).trim();
    if (nameOrSlug) ironManSlug = rrSlug(nameOrSlug) || nameOrSlug;
  }
  if (!ironManSlug) {
    const statsSource =
      match.statistics ??
      match.royalRumbleStatistics ??
      match.royal_rumble_statistics ??
      match.royalRumbleStats ??
      match.royal_rumble_stats ??
      rrObj.statistics ??
      rrObj.royalRumbleStatistics;
    let parsed = getIronManFromStatistics(statsSource);
    if (!parsed && match.result && /Iron\s*man|Iron\s*woman/i.test(match.result)) {
      parsed = getIronManFromStatistics(match.result);
    }
    if (!parsed && match.notes && /Iron\s*man|Iron\s*woman/i.test(match.notes)) {
      parsed = getIronManFromStatistics(match.notes);
    }
    if (parsed) ironManSlug = rrSlug(parsed) || parsed;
  }
  if (!ironManSlug && event) {
    const eventStats =
      event.statistics ??
      event.royalRumbleStatistics ??
      event.royal_rumble_statistics ??
      event.royalRumbleStats;
    const text = typeof eventStats === "string" ? eventStats : null;
    if (text && /Iron\s*man|Iron\s*woman/i.test(text)) {
      const pair = getIronManAndWomanFromText(text);
      const participantSlugs = new Set(participants.map((p) => rrSlug(p)));
      const womanSlug = pair.ironWomanName ? rrSlug(pair.ironWomanName) : null;
      const manSlug = pair.ironManName ? rrSlug(pair.ironManName) : null;
      if (womanSlug && participantSlugs.has(womanSlug)) ironManSlug = womanSlug;
      else if (manSlug && participantSlugs.has(manSlug)) ironManSlug = manSlug;
      else if (womanSlug) ironManSlug = womanSlug;
      else if (manSlug) ironManSlug = manSlug;
    }
    if (!ironManSlug && typeof eventStats === "object" && eventStats && !Array.isArray(eventStats)) {
      const parsedFromObj = getIronManFromStatistics(eventStats);
      if (parsedFromObj) ironManSlug = rrSlug(parsedFromObj) || parsedFromObj;
    }
  }
  if (!ironManSlug) {
    const participantSlugs = new Set(participants.map((p) => rrSlug(p)).filter(Boolean));
    let fallbackWoman = null;
    let fallbackMan = null;
    for (const obj of [match, event].filter(Boolean)) {
      for (const str of getAllStringValues(obj)) {
        if (!/Iron\s*man|Iron\s*woman/i.test(str)) continue;
        const pair = getIronManAndWomanFromText(str);
        const womanSlug = pair.ironWomanName ? rrSlug(pair.ironWomanName) : null;
        const manSlug = pair.ironManName ? rrSlug(pair.ironManName) : null;
        if (womanSlug) fallbackWoman = fallbackWoman || womanSlug;
        if (manSlug) fallbackMan = fallbackMan || manSlug;
        if (womanSlug && participantSlugs.has(womanSlug)) {
          ironManSlug = womanSlug;
          break;
        }
        if (manSlug && participantSlugs.has(manSlug)) {
          ironManSlug = manSlug;
          break;
        }
      }
      if (ironManSlug) break;
    }
    if (!ironManSlug && participantSlugs.size > 0) {
      if (fallbackWoman && participantSlugs.has(fallbackWoman)) ironManSlug = fallbackWoman;
      else if (fallbackMan && participantSlugs.has(fallbackMan)) ironManSlug = fallbackMan;
      else if (fallbackWoman) ironManSlug = fallbackWoman;
      else if (fallbackMan) ironManSlug = fallbackMan;
    }
  }
  } // end if (!ironManSlug) for fallback sources

  const timeInRingMinutes = rrObj.timeInRingMinutes ?? rrObj.time_in_ring_minutes;
  if (!ironManSlug && timeInRingMinutes && typeof timeInRingMinutes === "object" && !Array.isArray(timeInRingMinutes)) {
    let max = -1;
    for (const [s, val] of Object.entries(timeInRingMinutes)) {
      const n = Number(val);
      if (n > max) {
        max = n;
        ironManSlug = rrSlug(s) || s;
      }
    }
  }
  if (!ironManSlug && eliminatedOrder.length > 0 && Object.keys(entryNumberBySlug).length > 0) {
    const numParticipants = Math.max(participants.length, eliminatedOrder.length + 1, 30);
    let maxTime = -1;
    const eliminationRankBySlug = {};
    eliminatedOrder.forEach((slug, idx) => {
      eliminationRankBySlug[slug] = idx + 1;
    });
    if (winnerSlug) eliminationRankBySlug[winnerSlug] = numParticipants;
    for (const p of participants) {
      const slug = rrSlug(p);
      const entryNum = entryNumberBySlug[slug] ?? 30;
      const rank = eliminationRankBySlug[slug] ?? numParticipants;
      const time = rank - entryNum;
      if (time > maxTime) {
        maxTime = time;
        ironManSlug = slug;
      }
    }
  }

  const maxElims = Math.max(0, ...Object.values(eliminatorCount));
  let mostEliminationsSlugs = maxElims > 0
    ? Object.keys(eliminatorCount).filter((s) => eliminatorCount[s] === maxElims)
    : [];

  // Most Eliminations: (1) match root, (2) royalRumbleData, (3) statistics text
  const mostElimsFromMatch =
    match.mostEliminations ??
    match.mostEliminationsWrestler ??
    match.most_eliminations_wrestler;
  const mostElimsExplicit =
    mostElimsFromMatch ??
    rrObj.mostEliminationsWrestler ??
    rrObj.most_eliminations_wrestler ??
    rrObj.mostEliminations ??
    rrObj.mostEliminationsName;
  if (mostElimsExplicit) {
    const raw = typeof mostElimsExplicit === "string" ? mostElimsExplicit : Array.isArray(mostElimsExplicit) ? mostElimsExplicit.join(" & ") : String(mostElimsExplicit);
    const names = raw.split(/\s+&\s+/).map((s) => s.trim()).filter(Boolean);
    const fromExplicit = names.map((n) => rrSlug(n)).filter(Boolean);
    if (fromExplicit.length > 0) mostEliminationsSlugs = fromExplicit;
  }
  if (mostEliminationsSlugs.length === 0) {
    const statsSource =
      match.statistics ??
      match.royalRumbleStatistics ??
      match.royal_rumble_statistics ??
      match.royalRumbleStats ??
      rrObj.statistics;
    const parsed = getMostEliminationsFromStatistics(statsSource);
    if (parsed) {
      const names = parsed.split(/\s+&\s+/).map((s) => s.trim()).filter(Boolean);
      const fromText = names.map((n) => rrSlug(n)).filter(Boolean);
      if (fromText.length > 0) mostEliminationsSlugs = fromText;
    }
  }

  const wrestlerSlug = rrSlug(wrestlerName);
  for (const key of Object.keys(eliminatorCount)) {
    if (rrNameMatches(key, wrestlerName)) {
      out.eliminatorCountForWrestler = eliminatorCount[key];
      break;
    }
  }
  if (ironManSlug && rrNameMatches(ironManSlug, wrestlerName)) out.isIronMan = true;
  if (mostEliminationsSlugs.some((s) => rrNameMatches(s, wrestlerName))) out.isMostEliminations = true;

  return out;
}

/**
 * Parse Elimination Chamber match data for scoring.
 * Expects match.eliminationChamberData (or elimination_chamber_data) with:
 *   - eliminations: Array<{ eliminatedBy, eliminated } | { eliminator, eliminated }>
 *   - ironMan / ironManWrestler: optional
 * Or parses match.result and match.notes for "X eliminated Y (Method)" to build eliminator counts.
 * Returns { isParticipant, eliminatorCount, isIronMan } for the given wrestlerName.
 */
function getEliminationChamberStats(match, wrestlerName) {
  const out = { isParticipant: false, eliminatorCount: 0, isIronMan: false };
  const matchData = extractMatchParticipants(match);
  const participants = matchData.participantsForScoring ?? matchData.participants ?? [];
  const participantSlugs = new Set(participants.map((p) => rrSlug(typeof p === "string" ? p : (p && p.name) || "")).filter(Boolean));
  if (participantSlugs.size === 0) return out;
  const wrestlerSlug = rrSlug(wrestlerName);
  const isInMatch = wrestlerSlug && (participantSlugs.has(wrestlerSlug) || [...participantSlugs].some((s) => rrNameMatches(s, wrestlerName)));
  if (!isInMatch) return out;
  out.isParticipant = true;

  const ec = match?.eliminationChamberData ?? match?.elimination_chamber_data;
  const ecObj = ec && typeof ec === "object" ? ec : {};
  const eliminatorCount = /** @type {Record<string, number>} */ ({});
  const eliminatedOrder = /** @type {string[]} */ ([]);

  const rawEliminations = ecObj.eliminations ?? ecObj.elimination ?? [];
  if (Array.isArray(rawEliminations) && rawEliminations.length > 0) {
    for (const row of rawEliminations) {
      const eliminator = (row.eliminatedBy ?? row.eliminator ?? "").toString().trim();
      const eliminated = (row.eliminated ?? "").toString().trim();
      if (!eliminator || !eliminated) continue;
      const eliminatorS = rrSlug(eliminator);
      const eliminatedS = rrSlug(eliminated);
      if (eliminatorS) eliminatorCount[eliminatorS] = (eliminatorCount[eliminatorS] ?? 0) + 1;
      eliminatedOrder.push(eliminatedS || eliminated);
    }
  } else {
    const text = [match.result, match.notes].filter(Boolean).join(" ");
    if (text) {
      // Match "X eliminated Y (Method)" without crossing into next elimination
      const re = /(.+?)\s+eliminated\s+((?:(?!\s+eliminated\s+).)+?)\s*\([^)]+\)/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const eliminator = m[1].trim();
        const eliminated = m[2].trim();
        if (!eliminator || !eliminated) continue;
        const eliminatorS = rrSlug(eliminator);
        const eliminatedS = rrSlug(eliminated);
        if (eliminatorS) eliminatorCount[eliminatorS] = (eliminatorCount[eliminatorS] ?? 0) + 1;
        eliminatedOrder.push(eliminatedS || eliminated);
      }
    }
  }

  for (const key of Object.keys(eliminatorCount)) {
    if (rrNameMatches(key, wrestlerName)) {
      out.eliminatorCount = eliminatorCount[key];
      break;
    }
  }

  let ironManSlug = null;
  const ironManExplicit =
    match.ironMan ?? match.ironManWrestler ?? match.iron_woman ?? match.iron_man_wrestler
    ?? ecObj.ironMan ?? ecObj.ironManWrestler ?? ecObj.iron_man ?? ecObj.iron_man_wrestler;
  if (ironManExplicit != null) {
    const s = (typeof ironManExplicit === "string" ? ironManExplicit : String(ironManExplicit)).trim();
    if (s) ironManSlug = rrSlug(s) || s;
  }
  if (!ironManSlug) {
    const stats = match.statistics ?? match.eliminationChamberStatistics ?? ecObj.statistics;
    if (stats && typeof stats === "string") {
      const longest = stats.match(/Longest\s+Lasting[:\s]+([^-[\n]+?)(?:\s*[-[\n]|$)/i)
        || stats.match(/Iron\s*Man\/?\s*Iron\s*Woman[:\s]+([^-[\n]+?)(?:\s*[-[\n]|$)/i);
      if (longest && longest[1]) ironManSlug = rrSlug(longest[1].trim()) || longest[1].trim();
    }
  }
  if (!ironManSlug && eliminatedOrder.length > 0) {
    const winnerSlug = matchData.winners?.[0] ? rrSlug(matchData.winners[0]) : null;
    const lastEliminated = eliminatedOrder[eliminatedOrder.length - 1];
    if (lastEliminated && lastEliminated !== winnerSlug) ironManSlug = lastEliminated;
  }
  if (ironManSlug && rrNameMatches(ironManSlug, wrestlerName)) out.isIronMan = true;

  return out;
}

/**
 * Calculate points for a wrestler in a match
 */
export function calculateMatchPoints(match, event, allMatches, wrestlerName) {
  const points = {
    matchPoints: 0,
    titlePoints: 0,
    specialPoints: 0,
    mainEventPoints: 0,
    battleRoyalPoints: 0,
    total: 0,
    breakdown: [],
    /** Points toward Night of Champions total (KOTR qualifier/semi on Raw/SmackDown). Not added to total. */
    kotrTowardNOC: 0,
    /** "king" | "queen" when kotrTowardNOC > 0, for NOC participant lists. */
    kotrBracket: null,
    /** "first" | "semi" when kotrTowardNOC > 0, for breakdown. */
    kotrRound: null,
    /** NOC final: 10 for both finalists. */
    kotrFinalPoints: 0,
    /** NOC final: 20 for winner only. */
    kotrWinnerPoints: 0,
  };

  const eventType = event.classifiedType || "unknown";
  const singleMainEventOnly =
    eventType === EVENT_TYPES.SATURDAY_NIGHTS_MAIN_EVENT ||
    eventType === EVENT_TYPES.WRESTLEPALOOZA;
  const isMain = isMainEvent(match, allMatches, singleMainEventOnly);
  const isDQResult = isDQ(match);
  const isNC = isNoContest(match);
  const isBR = isBattleRoyal(match);
  const isTitle = isTitleMatch(match);
  const titleChanged = isTitleChange(match);
  const titleDefended = isTitleDefense(match);

  const matchData = extractMatchParticipants(match);
  const wrestlerSlugNorm = slugifyName(wrestlerName);
  const isWinner = matchData.winners.some(
    (w) => {
      if (!w) return false;
      const wSlug = slugifyName(w);
      if (wrestlerSlugNorm && wSlug && wrestlerSlugNorm === wSlug) return true;
      return (
        w.toLowerCase().includes(wrestlerName.toLowerCase()) ||
        wrestlerName.toLowerCase().includes(w.toLowerCase())
      );
    }
  );
  const isParticipant = matchData.participants.some(
    (p) =>
      p.toLowerCase().includes(wrestlerName.toLowerCase()) ||
      wrestlerName.toLowerCase().includes(p.toLowerCase())
  );

  if (!isParticipant) return points;

  if (isNC) {
    points.breakdown.push("No Contest - appearance points only");
  }

  if (isBR) {
    points.battleRoyalPoints += 1;
    points.breakdown.push("Battle Royal entry: +1");
    if (isWinner) {
      points.battleRoyalPoints += 8;
      points.breakdown.push("Battle Royal winner: +8");
    }
  }

  if (isTitle) {
    if (titleChanged && isWinner) {
      points.titlePoints += 5;
      points.breakdown.push("Title win: +5");
    } else if (!titleChanged) {
      // Retention: title didn't change. In a DQ, the champion retains (titles don't change hands on DQ).
      // Give +2 to the defending champion only. If match.defendingChampion is set, use that;
      // otherwise assume winner is the champion (challenger got DQ'd).
      if (isDQResult) {
        const defendingSlug =
          (match.defendingChampion ?? match.defending_champion ?? "")
            .toString()
            .trim();
        const isDefendingChampion = defendingSlug
          ? wrestlerSlugNorm && slugifyName(defendingSlug) === wrestlerSlugNorm
          : isWinner;
        if (isDefendingChampion) {
          points.titlePoints += 2;
          points.breakdown.push("Title defense (DQ): +2");
        }
      } else if (isWinner) {
        points.titlePoints += 4;
        points.breakdown.push("Title defense: +4");
      }
    }
  }

  const eventPoints = calculateEventSpecificPoints(
    match,
    event,
    allMatches,
    wrestlerName,
    isMain,
    isWinner,
    isDQResult,
    isNC,
    isTitle
  );

  points.matchPoints = eventPoints.matchPoints;
  points.specialPoints = eventPoints.specialPoints;
  points.mainEventPoints = eventPoints.mainEventPoints;
  points.breakdown.push(...eventPoints.breakdown);

  const isRS = eventType === EVENT_TYPES.RAW || eventType === EVENT_TYPES.SMACKDOWN;
  if (isRS) {
    const eventId = String(event?.id ?? "").toLowerCase();
    const isKnownNoStipEvent = KNOWN_KOTR_SEMI_EVENT_IDS.some((id) => eventId.includes(id));
    const knownSlot = getKnownKOTRSemiSlot(match, allMatches, event);
    if (knownSlot) {
      points.kotrTowardNOC = 7;
      points.kotrBracket = knownSlot.bracket;
      points.kotrRound = "semi";
      points.breakdown.push("King/Queen of the Ring semi-final (toward NOC): +7");
    } else if (!isKnownNoStipEvent && isKingOfTheRingMatch(match)) {
      // For known no-stip events we only use getKnownKOTRSemiSlot; skip text-based detection to avoid wrong adds.
      const kotrRound = getKingOfTheRingRound(match, allMatches, event);
      let bracket = isQueenOfTheRingMatch(match) ? "queen" : "king";
      if (bracket === "king" && isKnownWoman(wrestlerName)) bracket = "queen";
      if (kotrRound === "first") {
        points.kotrTowardNOC = 3;
        points.kotrBracket = bracket;
        points.kotrRound = "first";
        points.breakdown.push("King/Queen of the Ring qualifier (toward NOC): +3");
      } else if (kotrRound === "semi") {
        points.kotrTowardNOC = 7;
        points.kotrBracket = bracket;
        points.kotrRound = "semi";
        points.breakdown.push("King/Queen of the Ring semi-final (toward NOC): +7");
      }
    }
  }

  // DQ: win points are halved in calculateEventSpecificPoints per event type; no global halving.

  points.total =
    points.matchPoints +
    points.titlePoints +
    points.specialPoints +
    points.mainEventPoints +
    points.battleRoyalPoints +
    (points.kotrTowardNOC || 0);

  return points;
}

function calculateEventSpecificPoints(
  match,
  event,
  allMatches,
  wrestlerName,
  isMain,
  isWinner,
  isDQ,
  isNC,
  isTitle
) {
  const eventType = event.classifiedType || "unknown";
  const points = {
    matchPoints: 0,
    specialPoints: 0,
    mainEventPoints: 0,
    breakdown: [],
  };

  if (eventType === EVENT_TYPES.RAW || eventType === EVENT_TYPES.SMACKDOWN) {
    if (isMain) {
      if (isWinner) {
        const winPts = isDQ ? 2 : 4; // DQ: only win points halved
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning main event (DQ): +2" : "Winning main event: +4");
      }
      points.mainEventPoints += 3;
      points.breakdown.push("Main eventing: +3");
    } else {
      if (isWinner && !isNC) {
        const winPts = isDQ ? 1 : 2; // DQ: only win points halved (+2 → +1)
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning match (DQ): +1" : "Winning match: +2");
      }
      points.matchPoints += 1;
      points.breakdown.push("On match card: +1");
    }
    if (isTitle && isTitleChange(match) && isWinner) {
      points.breakdown.push("Title change: +5 (included in title points)");
    }
    return points;
  }

  if (eventType === EVENT_TYPES.WRESTLEMANIA_NIGHT_1) {
    if (isMain) {
      if (isWinner) {
        const winPts = isDQ ? 12 : 25;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning WrestleMania Night 1 main event (DQ): +12" : "Winning WrestleMania Night 1 main event: +25");
      }
      points.mainEventPoints += 20;
      points.breakdown.push("Main eventing WrestleMania Night 1: +20");
    } else {
      if (isWinner && !isNC) {
        const winPts = isDQ ? 6 : 12;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning WrestleMania match (DQ): +6" : "Winning WrestleMania match: +12");
      }
      points.matchPoints += 6;
      points.breakdown.push("On WrestleMania card: +6");
    }
    return points;
  }

  if (eventType === EVENT_TYPES.WRESTLEMANIA_NIGHT_2) {
    if (isMain) {
      if (isWinner) {
        const winPts = isDQ ? 17 : 35;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning WrestleMania Night 2 main event (DQ): +17" : "Winning WrestleMania Night 2 main event: +35");
      }
      points.mainEventPoints += 25;
      points.breakdown.push("Main eventing WrestleMania Night 2: +25");
    } else {
      if (isWinner && !isNC) {
        const winPts = isDQ ? 6 : 12;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning WrestleMania match (DQ): +6" : "Winning WrestleMania match: +12");
      }
      points.matchPoints += 6;
      points.breakdown.push("On WrestleMania card: +6");
    }
    return points;
  }

  if (
    eventType === EVENT_TYPES.SUMMERSLAM_NIGHT_1 ||
    eventType === EVENT_TYPES.SUMMERSLAM_NIGHT_2
  ) {
    if (isMain) {
      if (isWinner) {
        const winPts = isDQ ? 10 : 20;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning SummerSlam main event (DQ): +10" : "Winning SummerSlam main event: +20");
      }
      if (eventType === EVENT_TYPES.SUMMERSLAM_NIGHT_2) {
        points.mainEventPoints += 15;
        points.breakdown.push("Main eventing SummerSlam Night 2: +15");
      } else {
        points.mainEventPoints += 10;
        points.breakdown.push("Main eventing SummerSlam Night 1: +10");
      }
    } else {
      if (isWinner && !isNC) {
        const winPts = isDQ ? 5 : 10;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning SummerSlam match (DQ): +5" : "Winning SummerSlam match: +10");
      }
      points.matchPoints += 5;
      points.breakdown.push("On SummerSlam card: +5");
    }
    return points;
  }

  if (eventType === EVENT_TYPES.SURVIVOR_SERIES) {
    const matchType = getMatchType(match).toLowerCase();
    const isWarGames =
      matchType.includes("war games") ||
      (match.stipulation && match.stipulation.toLowerCase().includes("war games"));

    if (isWarGames) {
      // War Games: own scoring. No generic "on card" or "main event" — team 8, win 14, pinfall 10, entry 5/4/3/2/1.
      points.specialPoints += 8;
      points.breakdown.push("War Games team: +8");
      if (isWinner && !isNC) {
        points.specialPoints += 14;
        points.breakdown.push("Winning War Games: +14");
      }
      const pinfallWinner = getWarGamesPinfallWinner(match);
      if (pinfallWinner && nameMatches(pinfallWinner, wrestlerName)) {
        points.specialPoints += 10;
        points.breakdown.push("War Games pinfall: +10");
      }
      const entryPoints = getWarGamesEntryPoints(match, wrestlerName);
      if (entryPoints > 0) {
        points.specialPoints += entryPoints;
        points.breakdown.push(`War Games entry #${6 - entryPoints}: +${entryPoints}`);
      }
    } else {
      if (isWinner && !isNC) {
        const winPts = isDQ ? 5 : 10;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning Survivor Series match (DQ): +5" : "Winning Survivor Series match: +10");
      }
      points.matchPoints += 5;
      points.breakdown.push("On Survivor Series card: +5");
    }
    return points;
  }

  if (eventType === EVENT_TYPES.ROYAL_RUMBLE) {
    const matchType = getMatchType(match).toLowerCase();
    const isRumbleMatch =
      matchType.includes("royal rumble") ||
      match.specialWinnerType?.toLowerCase().includes("royal rumble");

    if (isRumbleMatch) {
      points.specialPoints += 2;
      points.breakdown.push("Royal Rumble participant: +2");

      const rr = getRoyalRumbleStats(match, wrestlerName, event);
      const elims = rr.eliminatorCountForWrestler ?? 0;
      if (elims > 0) {
        points.specialPoints += 3 * elims;
        points.breakdown.push(`Royal Rumble eliminations (${elims}): +${3 * elims}`);
      }
      if (rr.isIronMan) {
        points.specialPoints += 12;
        points.breakdown.push("Royal Rumble Iron Man / Iron Woman: +12");
      }
      if (rr.isMostEliminations) {
        points.specialPoints += 12;
        points.breakdown.push("Royal Rumble most eliminations: +12");
      }
      if (isWinner) {
        points.specialPoints += 30;
        points.breakdown.push("Royal Rumble winner: +30");
      }
    } else {
      if (isMain) {
        if (isWinner) {
          const winPts = isDQ ? 7 : 15;
          points.matchPoints += winPts;
          points.breakdown.push(isDQ ? "Winning Royal Rumble main event (DQ): +7" : "Winning Royal Rumble main event: +15");
        }
        points.mainEventPoints += 12;
        points.breakdown.push("Main eventing Royal Rumble: +12");
      } else {
        if (isWinner && !isNC) {
          const winPts = isDQ ? 5 : 10;
          points.matchPoints += winPts;
          points.breakdown.push(isDQ ? "Winning Royal Rumble match (DQ): +5" : "Winning Royal Rumble match: +10");
        }
        points.matchPoints += 5;
        points.breakdown.push("On Royal Rumble card: +5");
      }
    }
    return points;
  }

  if (eventType === EVENT_TYPES.ELIMINATION_CHAMBER) {
    const matchType = getMatchType(match).toLowerCase();
    const isChamberMatch =
      matchType.includes("elimination chamber") ||
      match.specialWinnerType?.toLowerCase().includes("elimination chamber");

    if (isChamberMatch) {
      if (match.stipulation?.toLowerCase().includes("qualifier")) {
        points.specialPoints += 10;
        points.breakdown.push("Elimination Chamber qualifier: +10");
      } else {
        // Main Elimination Chamber match: +10 all participants, +30 winner, +10 per elimination, +15 ironman
        const ecStats = getEliminationChamberStats(match, wrestlerName);
        if (ecStats.isParticipant) {
          points.specialPoints += 10;
          points.breakdown.push("Elimination Chamber participant: +10");
        }
        if (isWinner) {
          points.specialPoints += 30;
          points.breakdown.push("Winning Elimination Chamber: +30");
        }
        const elims = ecStats.eliminatorCount ?? 0;
        if (elims > 0) {
          points.specialPoints += 10 * elims;
          points.breakdown.push(`Elimination Chamber eliminations (${elims}): +${10 * elims}`);
        }
        if (ecStats.isIronMan) {
          points.specialPoints += 15;
          points.breakdown.push("Elimination Chamber longest lasting (ironman/ironwoman): +15");
        }
      }
    }

    if (isMain) {
      if (isWinner && !isChamberMatch) {
        const winPts = isDQ ? 7 : 15;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning Elimination Chamber main event (DQ): +7" : "Winning Elimination Chamber main event: +15");
      }
      if (!isChamberMatch) {
        points.mainEventPoints += 9;
        points.breakdown.push("Main eventing Elimination Chamber: +9");
      }
    } else {
      if (isWinner && !isNC && !isChamberMatch) {
        const winPts = isDQ ? 4 : 8;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning Elimination Chamber match (DQ): +4" : "Winning Elimination Chamber match: +8");
      }
      if (!isChamberMatch) {
        points.matchPoints += 4;
        points.breakdown.push("On Elimination Chamber card: +4");
      }
    }
    return points;
  }

  if (eventType === EVENT_TYPES.CROWN_JEWEL) {
    const isCJChampionship =
      match.title?.toLowerCase().includes("crown jewel") ||
      match.stipulation?.toLowerCase().includes("crown jewel championship");

    if (isCJChampionship) {
      if (isWinner) {
        points.specialPoints += 20;
        points.breakdown.push("Winning Crown Jewel Championship: +20");
      } else {
        points.specialPoints += 10;
        points.breakdown.push("Crown Jewel Championship match: +10");
      }
    }

    if (isMain && !isCJChampionship) {
      if (isWinner) {
        const winPts = isDQ ? 7 : 15;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning Crown Jewel main event (DQ): +7" : "Winning Crown Jewel main event: +15");
      }
      points.mainEventPoints += 9;
      points.breakdown.push("Main eventing Crown Jewel: +9");
    } else if (!isCJChampionship) {
      if (isWinner && !isNC) {
        const winPts = isDQ ? 4 : 8;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning Crown Jewel match (DQ): +4" : "Winning Crown Jewel match: +8");
      }
      points.matchPoints += 4;
      points.breakdown.push("On Crown Jewel card: +4");
    }
    return points;
  }

  if (
    eventType === EVENT_TYPES.NIGHT_OF_CHAMPIONS ||
    eventType === EVENT_TYPES.KING_QUEEN_OF_THE_RING
  ) {
    const isKOTR = isKingOfTheRingMatch(match);
    const kotrRound = isKOTR ? getKingOfTheRingRound(match, allMatches, event) : null;

    if (isKOTR && kotrRound) {
      const tournamentLabel = "King/Queen of the Ring";
      if (kotrRound === "first") {
        points.specialPoints += 3;
        points.kotrRound = "first";
        points.breakdown.push(`${tournamentLabel} first round: +3`);
      } else if (kotrRound === "semi") {
        points.specialPoints += 7;
        points.kotrRound = "semi";
        points.breakdown.push(`${tournamentLabel} semi-final: +7`);
      } else if (kotrRound === "final") {
        points.specialPoints += 10;
        points.kotrFinalPoints = 10;
        points.kotrWinnerPoints = isWinner && !isNC ? 20 : 0;
        points.breakdown.push(`${tournamentLabel} finalist: +10`);
        if (isWinner && !isNC) {
          points.specialPoints += 20;
          points.breakdown.push(`${tournamentLabel} winner: +20`);
        }
      }
      return points;
    }

    if (isMain) {
      if (isWinner) {
        const winPts = isDQ ? 7 : 15;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning Night of Champions main event (DQ): +7" : "Winning Night of Champions main event: +15");
      }
      points.mainEventPoints += 9;
      points.breakdown.push("Main eventing Night of Champions: +9");
    } else {
      if (isWinner && !isNC) {
        const winPts = isDQ ? 4 : 8;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning Night of Champions match (DQ): +4" : "Winning Night of Champions match: +8");
      }
      points.matchPoints += 4;
      points.breakdown.push("On Night of Champions card: +4");
    }
    return points;
  }

  if (eventType === EVENT_TYPES.MONEY_IN_THE_BANK) {
    const matchType = getMatchType(match).toLowerCase();
    const isMITBMatch =
      matchType.includes("money in the bank") ||
      match.specialWinnerType?.toLowerCase().includes("money in the bank");

    if (isMITBMatch) {
      if (
        match.stipulation?.toLowerCase().includes("qualifier") ||
        match.stipulation?.toLowerCase().includes("ladder match")
      ) {
        points.specialPoints += 12;
        points.breakdown.push("MITB ladder match participant: +12");
      }
      if (isWinner) {
        points.specialPoints += 25;
        points.breakdown.push("Money in the Bank winner: +25");
      }
    }

    if (isMain) {
      if (isWinner && !isMITBMatch) {
        const winPts = isDQ ? 7 : 15;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning MITB main event (DQ): +7" : "Winning MITB main event: +15");
      }
      if (!isMITBMatch) {
        points.mainEventPoints += 9;
        points.breakdown.push("Main eventing MITB: +9");
      }
    } else {
      if (isWinner && !isNC && !isMITBMatch) {
        const winPts = isDQ ? 4 : 8;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning MITB match (DQ): +4" : "Winning MITB match: +8");
      }
      if (!isMITBMatch) {
        points.matchPoints += 4;
        points.breakdown.push("On MITB card: +4");
      }
    }
    return points;
  }

  if (
    [
      EVENT_TYPES.SATURDAY_NIGHTS_MAIN_EVENT,
      EVENT_TYPES.BACKLASH,
      EVENT_TYPES.EVOLUTION,
      EVENT_TYPES.CLASH_IN_PARIS,
      EVENT_TYPES.WRESTLEPALOOZA,
    ].includes(eventType)
  ) {
    if (isMain) {
      if (isWinner) {
        const winPts = isDQ ? 6 : 12;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning minor PLE main event (DQ): +6" : "Winning minor PLE main event: +12");
      }
      points.mainEventPoints += 7;
      points.breakdown.push("Main eventing minor PLE: +7");
    } else {
      if (isWinner && !isNC) {
        const winPts = isDQ ? 3 : 6;
        points.matchPoints += winPts;
        points.breakdown.push(isDQ ? "Winning minor PLE match (DQ): +3" : "Winning minor PLE match: +6");
      }
      points.matchPoints += 3;
      points.breakdown.push("On minor PLE card: +3");
    }
    return points;
  }

  logger.warn(`Unknown event type: ${eventType} for event ${event.name}`);
  return points;
}
