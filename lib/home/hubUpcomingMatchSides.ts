import {
  extractMatchParticipants,
  parseParticipants,
} from "@/lib/scoring/parsers/participantParser.js";

/**
 * Group participant display names into sides for hub upcoming previews (insert "vs" between).
 */
export function splitUpcomingMatchSides(raw: Record<string, unknown>): string[][] | null {
  const rawParticipants = raw.participants;
  const matchType = String(raw.matchType || "").toLowerCase();
  const title = String(raw.title || "").toLowerCase();
  const stip = String(raw.stipulation || "").toLowerCase();
  const combined = `${matchType} ${title} ${stip}`;

  const isTag =
    combined.includes("tag team") ||
    combined.includes("tag-team") ||
    combined.includes("tag title") ||
    combined.includes("tag championship");

  const isFatalFour =
    combined.includes("fatal") ||
    combined.includes("4-way") ||
    combined.includes("four way") ||
    combined.includes("four-way") ||
    combined.includes("fatal four");

  const isMultiWay =
    isFatalFour ||
    combined.includes("triple threat") ||
    combined.includes("6-pack") ||
    combined.includes("six-pack");

  if (typeof rawParticipants === "string" && rawParticipants.trim()) {
    const s = rawParticipants.trim();
    if (/\s+vs\.?\s+/i.test(s)) {
      const sides = s
        .split(/\s+vs\.?\s+/i)
        .map((x) => x.trim())
        .filter(Boolean);
      const out = sides
        .map((part) => {
          const parsed = parseParticipants(part);
          return parsed
            .filter((p) => p.type === "individual")
            .map((p) => String(p.name || "").trim())
            .filter(Boolean);
        })
        .filter((side) => side.length > 0);
      return out.length >= 2 ? out : null;
    }
  }

  let names: string[] = [];
  try {
    const md = extractMatchParticipants(raw as never);
    names = (md.participantsForScoring ?? []).map((n) => String(n).trim()).filter(Boolean);
  } catch {
    return null;
  }
  if (names.length === 0) return null;
  if (names.length === 1) return [names];

  if (names.length === 2) return [[names[0]], [names[1]]];

  if (names.length === 3) {
    return names.map((n) => [n]);
  }

  if (names.length === 4) {
    if (isMultiWay) return names.map((n) => [n]);
    return [[names[0], names[1]], [names[2], names[3]]];
  }

  if (names.length === 6 && isTag) {
    return [
      [names[0], names[1], names[2]],
      [names[3], names[4], names[5]],
    ];
  }

  if (names.length >= 5) {
    return [names];
  }

  return [names];
}
