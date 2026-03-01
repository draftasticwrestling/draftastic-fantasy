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
        const winnerNames = result.winners.map((w) => (w || "").toLowerCase());
        result.losers = allParts
          .filter((p) => !winnerNames.includes((p.name || p).toLowerCase()))
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
        const winnerNames = result.winners.map((w) => (w || "").toLowerCase());
        result.losers = allParts
          .filter((p) => !winnerNames.includes((p.name || p).toLowerCase()))
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
      const winnerNames = result.winners.map((w) => w.toLowerCase());
      result.losers = allParts
        .filter((p) => !winnerNames.includes((p.name || p).toLowerCase()))
        .map((p) => p.name || p);
    }
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
        const winnerNames = winners.map((w) => (w || "").toLowerCase());
        losers = participantsForScoring
          .filter((p) => !winnerNames.includes((String(p).toLowerCase())))
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
