import { logger } from "../utils/logger.js";

/**
 * Parse participants from match data (from Boxscore scraper).
 * findWrestler not needed for extractMatchParticipants.
 */

export function parseParticipants(participantsStr) {
  if (!participantsStr) return [];
  let str =
    typeof participantsStr === "string"
      ? participantsStr
      : Array.isArray(participantsStr)
        ? participantsStr.join(" vs ")
        : String(participantsStr);

  const parts = str.split(/\s+vs\.?\s+/i);
  const allParticipants = [];

  for (const part of parts) {
    const teamMatch = part.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (teamMatch) {
      const teamName = teamMatch[1].trim();
      const members = teamMatch[2]
        .split(/[&,]/)
        .map((m) => m.trim())
        .filter(Boolean);
      allParticipants.push({ type: "team", name: teamName, members });
      members.forEach((member) => {
        allParticipants.push({ type: "individual", name: member });
      });
    } else {
      const trimmed = part.trim();
      // "Giulia & Kiana James" or "Jey Uso and Jimmy Uso" = two individuals
      if (trimmed.includes(" & ")) {
        const members = trimmed
          .split(/\s+&\s+/)
          .map((m) => m.trim())
          .filter(Boolean);
        members.forEach((member) => {
          allParticipants.push({ type: "individual", name: member });
        });
      } else if (trimmed.includes(" and ")) {
        const members = trimmed
          .split(/\s+and\s+/)
          .map((m) => m.trim())
          .filter(Boolean);
        members.forEach((member) => {
          allParticipants.push({ type: "individual", name: member });
        });
      } else {
        allParticipants.push({ type: "individual", name: trimmed });
      }
    }
  }
  return allParticipants;
}

export function parseWinnersAndLosers(resultStr, participantsStr) {
  const result = { winners: [], losers: [], unclear: [] };
  if (!resultStr && !participantsStr) return result;

  const lowerResult = (resultStr || "").toLowerCase();
  const defMatch = lowerResult.match(
    /(.+?)\s+(?:def\.?|defeats?|wins?)\s+(.+)/
  );
  if (defMatch) {
    const winners = parseParticipants(defMatch[1].trim());
    result.winners = winners.map((p) => p.name || p);
    const losers = parseParticipants(defMatch[2].trim());
    result.losers = losers.map((p) => p.name || p);
    return result;
  }

  // "Roman Reigns won the Royal Rumble" / "Liv Morgan won the Royal Rumble" (allow trailing text)
  const royalRumbleWonMatch = lowerResult.match(
    /^(.+?)\s+won\s+(?:the\s+)?(?:royal\s+)?rumble\b/i
  );
  if (royalRumbleWonMatch) {
    const winnerPart = (resultStr || "").match(
      /^(.+?)\s+won\s+(?:the\s+)?(?:royal\s+)?rumble\b/i
    );
    if (winnerPart) {
      const winners = parseParticipants(winnerPart[1].trim());
      result.winners = winners.map((p) => p.name || p);
      if (participantsStr) {
        const allParts = parseParticipants(participantsStr);
        const winnerSlugs = new Set(
          result.winners.map((w) => normalizeWrestlerName(String(w))).filter(Boolean)
        );
        result.losers = allParts
          .filter((p) => !winnerSlugs.has(normalizeWrestlerName(String(p.name || p))))
          .map((p) => p.name || p);
      }
      return result;
    }
  }

  // "Randy Orton won the Elimination Chamber" (allow trailing text)
  const eliminationChamberWonMatch = lowerResult.match(
    /^(.+?)\s+won\s+(?:the\s+)?(?:elimination\s+)?chamber\b/i
  );
  if (eliminationChamberWonMatch) {
    const winnerPart = (resultStr || "").match(
      /^(.+?)\s+won\s+(?:the\s+)?(?:elimination\s+)?chamber\b/i
    );
    if (winnerPart) {
      const winners = parseParticipants(winnerPart[1].trim());
      result.winners = winners.map((p) => p.name || p);
      if (participantsStr) {
        const allParts = parseParticipants(participantsStr);
        const winnerSlugs = new Set(
          result.winners.map((w) => normalizeWrestlerName(String(w))).filter(Boolean)
        );
        result.losers = allParts
          .filter((p) => !winnerSlugs.has(normalizeWrestlerName(String(p.name || p))))
          .map((p) => p.name || p);
      }
      return result;
    }
  }

  const winsMatch = lowerResult.match(/(.+?)\s+wins?$/);
  if (winsMatch) {
    const winners = parseParticipants(winsMatch[1].trim());
    result.winners = winners.map((p) => p.name || p);
    if (participantsStr) {
      const allParts = parseParticipants(participantsStr);
      const winnerSlugs = new Set(
        result.winners.map((w) => normalizeWrestlerName(String(w))).filter(Boolean)
      );
      result.losers = allParts
        .filter((p) => !winnerSlugs.has(normalizeWrestlerName(String(p.name || p))))
        .map((p) => p.name || p);
    }
    return result;
  }

  // "X lost to Y" → losers = X, winners = Y (e.g. "Cody and Jey lost to Solo and Roman")
  const lostToParts = (resultStr || "").match(/^(.+)\s+lost\s+to\s+(.+)$/i);
  if (lostToParts) {
    const loserPart = lostToParts[1].trim();
    const winnerPart = lostToParts[2].trim();
    if (loserPart && winnerPart) {
      const losers = parseParticipants(loserPart);
      result.losers = losers.map((p) => p.name || p);
      const winners = parseParticipants(winnerPart);
      result.winners = winners.map((p) => p.name || p);
      return result;
    }
  }

  // "X lost" or "X and Y lost" (no "to") → losers = X, winners = rest from participants
  const lostMatch = lowerResult.match(/^(.+)\s+lost\b/);
  if (lostMatch && participantsStr) {
    const loserPart = (resultStr || "").match(/^(.+)\s+lost\b/i);
    if (loserPart) {
      const losers = parseParticipants(loserPart[1].trim());
      result.losers = losers.map((p) => p.name || p);
      const loserSlugs = new Set(
        result.losers.map((l) => normalizeWrestlerName(String(l))).filter(Boolean)
      );
      const allParts = parseParticipants(participantsStr);
      result.winners = allParts
        .filter((p) => !loserSlugs.has(normalizeWrestlerName(String(p.name || p))))
        .map((p) => p.name || p);
      if (result.winners.length > 0) return result;
    }
  }

  // "X won" (past tense; not "won the Royal Rumble" / "won the Elimination Chamber")
  const wonMatch = lowerResult.match(/^(.+?)\s+won\b(?!\s+(?:the\s+)?(?:royal\s+)?rumble)(?!\s+(?:the\s+)?(?:elimination\s+)?chamber)/);
  if (wonMatch) {
    const winnerPart = (resultStr || "").match(/^(.+?)\s+won\b(?!\s+(?:the\s+)?(?:royal\s+)?rumble)(?!\s+(?:the\s+)?(?:elimination\s+)?chamber)/i);
    if (winnerPart) {
      const winners = parseParticipants(winnerPart[1].trim());
      result.winners = winners.map((p) => p.name || p);
      if (participantsStr) {
        const allParts = parseParticipants(participantsStr);
        const winnerSlugs = new Set(
          result.winners.map((w) => normalizeWrestlerName(String(w))).filter(Boolean)
        );
        result.losers = allParts
          .filter((p) => !winnerSlugs.has(normalizeWrestlerName(String(p.name || p))))
          .map((p) => p.name || p);
      }
      return result;
    }
  }

  // "No contest" / "no winner" — leave winners/losers empty; aggregation uses method for NC
  if (/\bno\s+contest\b/i.test(lowerResult) || /\bno\s+winner\b/i.test(lowerResult)) {
    return result;
  }

  if (participantsStr && !resultStr) {
    logger.warn(`Could not parse result, using participants: ${participantsStr}`);
    result.unclear = parseParticipants(participantsStr).map((p) => p.name || p);
  } else {
    logger.warn(`Could not parse result string: ${resultStr}`);
    result.unclear = [resultStr];
  }
  return result;
}

/**
 * Get explicit winner from match object (Boxscore / prowrestlingboxscore.com).
 * Checks match.winner, match.winnerWrestler, match.winnerName, and statistics text "Winner: Name".
 */
function getExplicitWinnerFromMatch(match) {
  if (!match || typeof match !== "object") return null;
  const w =
    match.winner ??
    match.winnerWrestler ??
    match.winnerName ??
    match.winner_slug ??
    match.winner_wrestler ??
    match.winner_name;
  if (w != null) {
    const s = typeof w === "string" ? w.trim() : String(w).trim();
    if (s) return s;
  }
  const stats =
    match.statistics ??
    match.royalRumbleStatistics ??
    match.royal_rumble_statistics;
  if (stats && typeof stats === "string") {
    const m = stats.match(/Winner[:\s]+([^\n-]+?)(?:\s*[-|\n]|$)/i);
    if (m) return m[1].trim() || null;
  }
  return null;
}

export function extractMatchParticipants(match) {
  const resultStr = match.result || "";
  let participants;
  let participantsForScoring;
  const rawParticipants = match.participants;

  // Supabase/Boxscore: participants can be an array of slugs (e.g. Royal Rumble)
  if (Array.isArray(rawParticipants) && rawParticipants.length > 0) {
    const slugList = rawParticipants.map((p) => (typeof p === "string" ? p : String(p)).trim()).filter(Boolean);
    participants = slugList.map((name) => ({ type: "individual", name }));
    participantsForScoring = slugList;
  } else {
    const participantsStr = rawParticipants || "";
    participants = parseParticipants(participantsStr);
    participantsForScoring = participants
      .filter((p) => p.type === "individual")
      .map((p) => p.name || p);
  }

  const participantsStr = Array.isArray(rawParticipants)
    ? rawParticipants.join(" vs ")
    : rawParticipants || "";
  let { winners, losers, unclear } = parseWinnersAndLosers(
    resultStr,
    participantsStr
  );
  // Boxscore: use explicit winner when result string didn't parse (e.g. Royal Rumble)
  if (winners.length === 0) {
    const explicitWinner = getExplicitWinnerFromMatch(match);
    if (explicitWinner) {
      const parsed = parseParticipants(explicitWinner);
      winners = parsed.map((p) => p.name || p).filter(Boolean);
      if (participantsForScoring.length > 0 && winners.length > 0) {
        const winnerSlugs = new Set(
          winners.map((w) => normalizeWrestlerName(String(w))).filter(Boolean)
        );
        losers = participantsForScoring
          .filter((p) => !winnerSlugs.has(normalizeWrestlerName(String(p))))
          .map((p) => String(p));
      }
    }
  }
  return {
    participants: participants.map((p) => p.name || p),
    participantsForScoring,
    winners,
    losers,
    unclear,
    hasResult: !!resultStr,
    isTagTeam: participants.some((p) => p.type === "team"),
  };
}

/** Normalize apostrophes so "Je'Von" and "Je'Von" slug the same. */
function normalizeApostrophes(s) {
  if (typeof s !== "string") return s;
  return s.replace(/[\u2018\u2019\u201A\u201B\u2032']/g, "");
}

export function normalizeWrestlerName(name) {
  if (!name) return "";
  return normalizeApostrophes(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
