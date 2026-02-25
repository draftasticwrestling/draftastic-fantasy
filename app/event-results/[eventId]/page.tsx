import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";

// Always compute fresh so King/Queen points and prior carryover are correct
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { data: event } = await supabase
    .from("events")
    .select("name, date")
    .eq("id", eventId)
    .single();
  const title = event?.name
    ? `${event.name} — Results`
    : "Event results — Draftastic Fantasy";
  return { title };
}

function formatEventType(type: string): string {
  const labels: Record<string, string> = {
    raw: "RAW",
    smackdown: "SmackDown",
    "wrestlemania-night-1": "WrestleMania Night 1",
    "wrestlemania-night-2": "WrestleMania Night 2",
    "summerslam-night-1": "SummerSlam Night 1",
    "summerslam-night-2": "SummerSlam Night 2",
    "survivor-series": "Survivor Series",
    "royal-rumble": "Royal Rumble",
    "elimination-chamber": "Elimination Chamber",
    "crown-jewel": "Crown Jewel",
    "night-of-champions": "Night of Champions",
    "money-in-the-bank": "Money in the Bank",
    "saturday-nights-main-event": "Saturday Night's Main Event",
    backlash: "Backlash",
    evolution: "Evolution",
    "clash-in-paris": "Clash at the Castle",
    wrestlepalooza: "Wrestlepalooza",
  };
  return labels[type] || type;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", {
      month: "long",
    });
    return `${month} ${d}, ${y}`;
  }
  return dateStr;
}

/** Turn slug into display name when we don't have it in the wrestlers table */
function formatSlug(slug: string): string {
  if (!slug) return slug;
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Replace slugs in a string with display names; longest slugs first to avoid partial matches */
function replaceSlugsInString(
  str: string | string[] | null | undefined,
  slugToName: Map<string, string>
): string {
  if (str == null) return "";
  const out =
    typeof str === "string" ? str : Array.isArray(str) ? str.join(", ") : String(str);
  if (typeof out !== "string") return "";
  let result = out;
  const sortedSlugs = [...slugToName.keys()].sort(
    (a, b) => b.length - a.length
  );
  for (const slug of sortedSlugs) {
    const name = slugToName.get(slug)!;
    const regex = new RegExp(`\\b${escapeRegex(slug)}\\b`, "gi");
    result = result.replace(regex, name);
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type RawMatchKOTR = {
  order?: number;
  matchType?: string;
  stipulation?: string;
  title?: string;
  match_type?: string;
  round?: string;
  bracket_round?: string;
  stage?: string;
  Stipulation?: string;
};

import type { ScoredEvent } from "@/lib/scoring/types";

/** Same combined string as calculator: matchType, stipulation/Stipulation, title, round/stage. */
function getKOTRCombined(rawMatch: RawMatchKOTR | null): string {
  if (!rawMatch) return "";
  const mt = (rawMatch.matchType ?? (rawMatch as { match_type?: string }).match_type ?? "").toLowerCase();
  const st = (rawMatch.stipulation ?? rawMatch.Stipulation ?? (rawMatch as { match_type?: string }).match_type ?? "").toLowerCase();
  const ti = (rawMatch.title ?? "").toLowerCase();
  const round = (rawMatch.round ?? rawMatch.bracket_round ?? rawMatch.stage ?? "").toLowerCase();
  return `${mt} ${st} ${ti} ${round}`;
}

/** True if match is Queen of the Ring (women's bracket). Strict: only explicit tournament so totals stay 3/10/20/40. */
function isQueenOfTheRingMatch(rawMatch: RawMatchKOTR | null): boolean {
  const combined = getKOTRCombined(rawMatch);
  if (combined.includes("queen of the ring") || combined.includes("qotr")) return true;
  if (combined.includes("king and queen") || combined.includes("king & queen")) return true;
  if (combined.includes("women") && (combined.includes("qualifier") || combined.includes("semi") || combined.includes("final") || combined.includes("first round")) && combined.includes("ring")) return true;
  if (combined.includes("women") && (combined.includes("semi") || combined.includes("semifinal"))) return true;
  return false;
}

/** True if match is King/Queen of the Ring (either bracket). Same logic as calculator isKingOfTheRingMatch. */
function isKOTRMatch(rawMatch: RawMatchKOTR | null): boolean {
  const combined = getKOTRCombined(rawMatch);
  return (
    combined.includes("king of the ring") ||
    combined.includes("queen of the ring") ||
    combined.includes("kotr") ||
    combined.includes("qotr") ||
    combined.includes("king & queen") ||
    combined.includes("king and queen") ||
    ((combined.includes("qualifier") || combined.includes("semi") || combined.includes("first round")) &&
      (combined.includes("ring") || combined.includes("king") || combined.includes("queen") || combined.includes("women")))
  );
}

/** True if match is explicitly a qualifier or semi (so we must NOT add to tournament pts from NOC — they come from prior R/S only). Same keywords as calculator. */
function isExplicitlyQualifierOrSemi(rawMatch: RawMatchKOTR | null): boolean {
  const combined = getKOTRCombined(rawMatch);
  return (
    combined.includes("qualifier") ||
    combined.includes("first round") ||
    combined.includes("quarter") ||
    combined.includes("semi") ||
    combined.includes("semifinal")
  );
}

/** Round of KOTR match: "first" | "semi" | "final". Only add final from NOC; qualifier/semi come from prior R/S. */
function getKOTRRound(rawMatch: RawMatchKOTR | null, allRawMatches: RawMatchKOTR[]): "first" | "semi" | "final" {
  if (!rawMatch) return "first";
  const combined = getKOTRCombined(rawMatch);
  if (combined.includes("qualifier") || combined.includes("first round") || combined.includes("quarter")) return "first";
  if (combined.includes("semi-final") || combined.includes("semi final") || /\bsemi\b/.test(combined) || combined.includes("semifinal")) return "semi";
  if (combined.includes("final") && !combined.includes("semi")) return "final";
  const kotrMatches = allRawMatches.filter((m) => isKOTRMatch(m));
  const maxOrder = Math.max(0, ...kotrMatches.map((m) => m.order ?? 0));
  if ((rawMatch.order ?? 0) >= maxOrder) return "final";
  return "first";
}

/** True only when match is explicitly the tournament final (text contains "final", not "semi"). Used so we never add NOC qualifier/semi to tournament table (avoids 43, 6, etc.). */
function isExplicitlyFinalOnly(rawMatch: RawMatchKOTR | null): boolean {
  if (!rawMatch) return false;
  const combined = getKOTRCombined(rawMatch);
  return combined.includes("final") && !combined.includes("semi");
}

export default async function EventResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const debugKotr = search?.debug === "kotr" || search?.debug === "1";

  const { data: event, error } = await supabase
    .from("events")
    .select("id, name, date, location, matches")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    notFound();
  }

  const { scoreEvent } = await import("@/lib/scoring/scoreEvent.js");
  const { EVENT_TYPES } = await import("@/lib/scoring/parsers/eventClassifier.js");
  const { normalizeWrestlerName } = await import("@/lib/scoring/parsers/participantParser.js");

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name");
  const slugToName = new Map<string, string>();
  const slugToCanonical = new Map<string, string>();
  for (const w of wrestlers ?? []) {
    const id = (w.id ?? "").toString().trim();
    const name = (w.name ?? "").toString().trim();
    if (id) {
      slugToName.set(id, name || id);
      const normId = normalizeWrestlerName(id);
      const normName = normalizeWrestlerName(name);
      if (normId) slugToCanonical.set(normId, id);
      if (normName) slugToCanonical.set(normName, id);
    }
  }
  function toCanonicalSlug(slug: string): string {
    return slugToCanonical.get(slug) ?? slug;
  }

  const scored = scoreEvent(event) as ScoredEvent;

  const totalsByWrestler = new Map<string, number>();
  const slugToDisplayName = new Map<string, string>();
  const rawMatches = (event.matches || []) as RawMatchKOTR[];
  for (const match of scored.matches) {
    if ((match as { isPromo?: boolean }).isPromo || !match.wrestlerPoints) continue;
    for (const wp of match.wrestlerPoints) {
      const slug = normalizeWrestlerName(wp.wrestler) || wp.wrestler;
      const canon = toCanonicalSlug(slug);
      if (!slugToDisplayName.has(canon)) slugToDisplayName.set(canon, wp.wrestler);
      totalsByWrestler.set(canon, (totalsByWrestler.get(canon) ?? 0) + (wp.total ?? 0));
    }
  }

  const kingPoints: Record<string, number> = {};
  const queenPoints: Record<string, number> = {};
  type KotrBreakdown = { qualifier: number; semi: number; final: number; winner: number };
  const emptyBreakdown = (): KotrBreakdown => ({ qualifier: 0, semi: 0, final: 0, winner: 0 });
  const kingBreakdown: Record<string, KotrBreakdown> = {};
  const queenBreakdown: Record<string, KotrBreakdown> = {};
  const isKOTRPLE =
    scored.eventType === EVENT_TYPES.NIGHT_OF_CHAMPIONS ||
    scored.eventType === EVENT_TYPES.KING_QUEEN_OF_THE_RING;

  type KotrDebugRow = { eventId: string; eventName: string; date: string; eventType: string; isRS: boolean; matchSummary: string[] };
  type RawMatchInspect = { order: number; keys: string[]; stipulationLike: string; participantsLike: string };
  let kotrDebugRows: KotrDebugRow[] = [];
  let kotrDebugKings: Record<string, number> = {};
  let kotrDebugQueens: Record<string, number> = {};
  let kotrDebugJune20: { eventId: string; date: string; name: string; matchesInspect: RawMatchInspect[] } | null = null;
  let kotrForceFetchLog: { id: string; found: boolean; error?: string; eventType?: string; matchCount?: number; added?: string[]; matchHints?: string[] }[] = [];
  let priorWindowStart = "";
  let priorWindowEnd = "";
  let priorEventCount = 0;

  if (isKOTRPLE && event.date) {
    const nocQueenFinalMatches = scored.matches.filter((scoredMatch) => {
      if ((scoredMatch as { isPromo?: boolean }).isPromo || !scoredMatch.wrestlerPoints) return false;
      const rawMatch = rawMatches.find((m) => m.order === scoredMatch.order) ?? null;
      if (!isKOTRMatch(rawMatch) || !isQueenOfTheRingMatch(rawMatch)) return false;
      if (isExplicitlyQualifierOrSemi(rawMatch)) return false;
      return true;
    });
    const singleQueenFinalMatch = nocQueenFinalMatches.length === 1 ? nocQueenFinalMatches[0] : null;

    const nocKingFinalMatches = scored.matches.filter((scoredMatch) => {
      if ((scoredMatch as { isPromo?: boolean }).isPromo || !scoredMatch.wrestlerPoints) return false;
      const rawMatch = rawMatches.find((m) => m.order === scoredMatch.order) ?? null;
      if (!isKOTRMatch(rawMatch) || isQueenOfTheRingMatch(rawMatch)) return false;
      if (isExplicitlyQualifierOrSemi(rawMatch)) return false;
      return true;
    });
    const singleKingFinalMatch = nocKingFinalMatches.length === 1 ? nocKingFinalMatches[0] : null;

    for (const scoredMatch of scored.matches) {
      if ((scoredMatch as { isPromo?: boolean }).isPromo || !scoredMatch.wrestlerPoints) continue;
      const rawMatch = rawMatches.find((m) => m.order === scoredMatch.order) ?? null;
      if (!isKOTRMatch(rawMatch)) continue;
      if (isExplicitlyQualifierOrSemi(rawMatch)) continue;
      const isQueen = isQueenOfTheRingMatch(rawMatch);
      const isExplicitFinal = isExplicitlyFinalOnly(rawMatch);
      const isSingleQueenMatch = isQueen && singleQueenFinalMatch === scoredMatch;
      const isSingleKingFinal = !isQueen && singleKingFinalMatch === scoredMatch;
      if (!isExplicitFinal && !isSingleQueenMatch && !isSingleKingFinal) continue;
      for (const wp of scoredMatch.wrestlerPoints ?? []) {
        const slug = normalizeWrestlerName(wp.wrestler);
        if (!slug) continue;
        const canon = toCanonicalSlug(slug);
        if (!slugToDisplayName.has(canon)) slugToDisplayName.set(canon, wp.wrestler);
        const pts = wp.total;
        let finalPts = (wp as { kotrFinalPoints?: number }).kotrFinalPoints ?? 0;
        let winnerPts = (wp as { kotrWinnerPoints?: number }).kotrWinnerPoints ?? 0;
        if (isSingleQueenMatch && finalPts === 0 && winnerPts === 0) {
          const wps = scoredMatch.wrestlerPoints ?? [];
          const maxPtsInMatch = Math.max(0, ...wps.map((w) => (w as { total?: number }).total ?? 0));
          const firstMaxIdx = wps.findIndex((w) => ((w as { total?: number }).total ?? 0) >= maxPtsInMatch && maxPtsInMatch > 0);
          const isWinner = firstMaxIdx >= 0 && wps[firstMaxIdx] === wp;
          finalPts = 10;
          winnerPts = isWinner ? 20 : 0;
        }
        if (isSingleKingFinal && finalPts === 0 && winnerPts === 0) {
          const wps = scoredMatch.wrestlerPoints ?? [];
          const maxPtsInMatch = Math.max(0, ...wps.map((w) => (w as { total?: number }).total ?? 0));
          const firstMaxIdx = wps.findIndex((w) => ((w as { total?: number }).total ?? 0) >= maxPtsInMatch && maxPtsInMatch > 0);
          const isWinner = firstMaxIdx >= 0 && wps[firstMaxIdx] === wp;
          finalPts = 10;
          winnerPts = isWinner ? 20 : 0;
        }
        if (isQueen) {
          const toAdd = isSingleQueenMatch ? (finalPts + winnerPts) : (pts ?? 0);
          queenPoints[canon] = (queenPoints[canon] ?? 0) + toAdd;
          if (!queenBreakdown[canon]) queenBreakdown[canon] = emptyBreakdown();
          queenBreakdown[canon].final += finalPts;
          queenBreakdown[canon].winner += winnerPts;
        } else {
          const toAdd = isSingleKingFinal ? (finalPts + winnerPts) : (pts ?? 0);
          kingPoints[canon] = (kingPoints[canon] ?? 0) + toAdd;
          if (!kingBreakdown[canon]) kingBreakdown[canon] = emptyBreakdown();
          kingBreakdown[canon].final += finalPts;
          kingBreakdown[canon].winner += winnerPts;
        }
      }
    }

    const eventDate = new Date(event.date);
    const startDate = new Date(eventDate);
    startDate.setDate(startDate.getDate() - 90);
    const startStr = startDate.toISOString().slice(0, 10);
    priorWindowStart = startStr;
    priorWindowEnd = event.date ?? "";
    const currentEventId = String(event.id ?? "");
    const nocDateMs = event.date ? new Date(event.date).getTime() : 0;

    const { data: priorByDate } = await supabase
      .from("events")
      .select("id, name, date, matches")
      .gte("date", startStr)
      .lte("date", event.date)
      .order("date", { ascending: true });
    let priorEvents = (priorByDate ?? []).filter((e) => String(e.id) !== currentEventId);
    const priorIds = new Set(priorEvents.map((e) => String(e.id)));

    const knownKotrEventIds = ["smackdown-20250620", "smackdown-20260620", "raw-20250623", "raw-20260623"];
    const toFetchById = knownKotrEventIds.filter((id) => !priorIds.has(id));
    if (toFetchById.length > 0) {
      const { data: byId } = await supabase
        .from("events")
        .select("id, name, date, matches")
        .in("id", toFetchById);
      if (byId?.length) {
        for (const e of byId) {
          if (String(e.id) === currentEventId) continue;
          const d = e.date ? new Date(e.date).getTime() : 0;
          if (d < nocDateMs) {
            priorEvents = [...priorEvents, e];
            priorIds.add(String(e.id));
          }
        }
      }
    }
    priorEventCount = priorEvents.length;
    const kingFromPrior: Record<string, number> = {};
    const queenFromPrior: Record<string, number> = {};
    const kingFromPriorBreakdown: Record<string, KotrBreakdown> = {};
    const queenFromPriorBreakdown: Record<string, KotrBreakdown> = {};
    kotrDebugQueens = queenFromPrior;
    kotrDebugKings = kingFromPrior;

    const forceKotrIds = ["smackdown-20250620", "raw-20250623"];
    const processedForceIds = new Set<string>();
    kotrForceFetchLog = [];
    for (const fid of forceKotrIds) {
      if (fid === currentEventId) {
        kotrForceFetchLog.push({ id: fid, found: true, eventType: "(current event, skipped)" });
        continue;
      }
      const { data: forceEv, error: forceErr } = await supabase
        .from("events")
        .select("id, name, date, matches")
        .eq("id", fid)
        .single();
      if (forceErr) {
        kotrForceFetchLog.push({ id: fid, found: false, error: forceErr.message });
        continue;
      }
      if (!forceEv) {
        kotrForceFetchLog.push({ id: fid, found: false, error: "No data" });
        continue;
      }
      const matchCount = Array.isArray(forceEv.matches) ? forceEv.matches.length : 0;
      if (!forceEv.matches || matchCount === 0) {
        kotrForceFetchLog.push({ id: fid, found: true, matchCount: 0, error: "No matches" });
        continue;
      }
      const forceDateMs = forceEv.date ? new Date(forceEv.date).getTime() : 0;
      if (forceDateMs >= nocDateMs) {
        kotrForceFetchLog.push({ id: fid, found: true, matchCount, eventType: "date not before NOC", error: `event date >= NOC` });
        continue;
      }
      const forceScored = scoreEvent(forceEv) as ScoredEvent;
      const forceRS =
        forceScored.eventType === EVENT_TYPES.RAW ||
        forceScored.eventType === EVENT_TYPES.SMACKDOWN;
      const added: string[] = [];
      if (!forceRS) {
        kotrForceFetchLog.push({ id: fid, found: true, matchCount, eventType: forceScored.eventType ?? "unknown", error: "Not Raw/SmackDown" });
        continue;
      }
      processedForceIds.add(String(fid).toLowerCase());
      for (const m of forceScored.matches ?? []) {
        if ((m as { isPromo?: boolean }).isPromo || !m.wrestlerPoints) continue;
        for (const wp of m.wrestlerPoints) {
          const toward = (wp as { kotrTowardNOC?: number }).kotrTowardNOC ?? 0;
          const bracket = (wp as { kotrBracket?: string | null }).kotrBracket ?? "king";
          const round = (wp as { kotrRound?: string | null }).kotrRound ?? (toward === 7 ? "semi" : "first");
          if (toward > 0) {
            const slug = normalizeWrestlerName(wp.wrestler);
            if (slug) {
              const canon = toCanonicalSlug(slug);
              if (bracket === "queen") {
                if (!queenFromPriorBreakdown[canon]) queenFromPriorBreakdown[canon] = emptyBreakdown();
                const bd = queenFromPriorBreakdown[canon];
                const atQualifierCap = bd.qualifier >= 3;
                const atSemiCap = bd.semi >= 7;
                if (round === "first" && !atQualifierCap) {
                  bd.qualifier += 3;
                  queenFromPrior[canon] = (queenFromPrior[canon] ?? 0) + toward;
                  added.push(`${wp.wrestler} +${toward} ${bracket}`);
                } else if (round === "semi" && !atSemiCap) {
                  bd.semi += 7;
                  queenFromPrior[canon] = (queenFromPrior[canon] ?? 0) + toward;
                  added.push(`${wp.wrestler} +${toward} ${bracket}`);
                }
              } else {
                if (!kingFromPriorBreakdown[canon]) kingFromPriorBreakdown[canon] = emptyBreakdown();
                const bd = kingFromPriorBreakdown[canon];
                const atQualifierCap = bd.qualifier >= 3;
                const atSemiCap = bd.semi >= 7;
                if (round === "first" && !atQualifierCap) {
                  bd.qualifier += 3;
                  kingFromPrior[canon] = (kingFromPrior[canon] ?? 0) + toward;
                  added.push(`${wp.wrestler} +${toward} ${bracket}`);
                } else if (round === "semi" && !atSemiCap) {
                  bd.semi += 7;
                  kingFromPrior[canon] = (kingFromPrior[canon] ?? 0) + toward;
                  added.push(`${wp.wrestler} +${toward} ${bracket}`);
                }
              }
              if (!slugToDisplayName.has(canon)) slugToDisplayName.set(canon, wp.wrestler);
            }
          }
        }
      }
      const matchHints =
        added.length === 0 && Array.isArray(forceEv.matches)
          ? (forceEv.matches as Record<string, unknown>[]).map((m, i) => {
              const stip = [m.stipulation, m.Stipulation, m.match_type, m.matchType].filter(Boolean).join(" | ") || "(none)";
              const title = String(m.title ?? "").slice(0, 40);
              const round = [m.round, m.bracket_round, m.stage].filter(Boolean).join(" | ") || "";
              return `#${i + 1}: ${stip}${title ? ` · title: ${title}` : ""}${round ? ` · round: ${round}` : ""}`;
            })
          : undefined;
      kotrForceFetchLog.push({ id: fid, found: true, eventType: forceScored.eventType ?? "", matchCount, added, matchHints });
    }

    const seenEventIds = new Set<string>();
    kotrDebugRows = [];
    for (const ev of priorEvents ?? []) {
      if (!ev?.id || seenEventIds.has(String(ev.id))) continue;
      if (processedForceIds.has(String(ev.id).toLowerCase())) continue;
      seenEventIds.add(String(ev.id));
      const priorScored = scoreEvent(ev) as ScoredEvent;
      const isRS =
        priorScored.eventType === EVENT_TYPES.RAW ||
        priorScored.eventType === EVENT_TYPES.SMACKDOWN;
      const matchSummaries: string[] = [];
      if (debugKotr) {
        kotrDebugRows.push({
          eventId: String(ev.id),
          eventName: String(ev.name ?? ""),
          date: String(ev.date ?? ""),
          eventType: priorScored.eventType ?? "unknown",
          isRS,
          matchSummary: matchSummaries,
        });
        const evId = String(ev.id ?? "").toLowerCase();
        const evDate = String(ev.date ?? "");
        const isJune20SmackDown =
          (evId.includes("smackdown") && (evId.includes("20250620") || evId.includes("20260620"))) ||
          /202[56]-06-20/.test(evDate);
        if (isJune20SmackDown) {
          const rawMatches = (ev as { matches?: unknown[] }).matches ?? [];
          kotrDebugJune20 = {
            eventId: String(ev.id),
            date: evDate,
            name: String(ev.name ?? ""),
            matchesInspect: rawMatches.map((m: unknown) => {
              const match = m as Record<string, unknown>;
              const keys = Object.keys(match);
              const stipulationLike = [match.stipulation, match.Stipulation, match.match_type, match.matchType, match.title]
                .filter(Boolean)
                .map((v) => String(v))
                .join(" | ") || "(none)";
              const participantsLike = String(match.participants ?? "(none)");
              return {
                order: Number(match.order ?? 0),
                keys,
                stipulationLike,
                participantsLike: participantsLike.slice(0, 80),
              };
            }),
          };
        }
      }
      if (!isRS) continue;
      for (const m of priorScored.matches ?? []) {
        if ((m as { isPromo?: boolean }).isPromo || !m.wrestlerPoints) continue;
        const towardList: { wrestler: string; toward: number; bracket: string }[] = [];
        for (const wp of m.wrestlerPoints) {
          const toward = (wp as { kotrTowardNOC?: number }).kotrTowardNOC ?? 0;
          const bracket = (wp as { kotrBracket?: string | null }).kotrBracket ?? "king";
          const round = (wp as { kotrRound?: string | null }).kotrRound ?? (toward === 7 ? "semi" : "first");
          if (toward > 0) {
            const slug = normalizeWrestlerName(wp.wrestler);
            if (slug) {
              const canon = toCanonicalSlug(slug);
              if (bracket === "queen") {
                if (!queenFromPriorBreakdown[canon]) queenFromPriorBreakdown[canon] = emptyBreakdown();
                const bd = queenFromPriorBreakdown[canon];
                const atQualifierCap = bd.qualifier >= 3;
                const atSemiCap = bd.semi >= 7;
                if (round === "first" && !atQualifierCap) {
                  bd.qualifier += 3;
                  queenFromPrior[canon] = (queenFromPrior[canon] ?? 0) + toward;
                } else if (round === "semi" && !atSemiCap) {
                  bd.semi += 7;
                  queenFromPrior[canon] = (queenFromPrior[canon] ?? 0) + toward;
                }
              } else {
                if (!kingFromPriorBreakdown[canon]) kingFromPriorBreakdown[canon] = emptyBreakdown();
                const bd = kingFromPriorBreakdown[canon];
                const atQualifierCap = bd.qualifier >= 3;
                const atSemiCap = bd.semi >= 7;
                if (round === "first" && !atQualifierCap) {
                  bd.qualifier += 3;
                  kingFromPrior[canon] = (kingFromPrior[canon] ?? 0) + toward;
                } else if (round === "semi" && !atSemiCap) {
                  bd.semi += 7;
                  kingFromPrior[canon] = (kingFromPrior[canon] ?? 0) + toward;
                }
              }
              if (!slugToDisplayName.has(canon)) slugToDisplayName.set(canon, wp.wrestler);
              if (debugKotr) towardList.push({ wrestler: wp.wrestler, toward, bracket });
            }
          }
        }
        if (debugKotr && towardList.length > 0)
          matchSummaries.push(`order ${(m as { order?: number }).order}: ${towardList.map((t) => `${t.wrestler} +${t.toward} ${t.bracket}`).join(", ")}`);
      }
    }
    for (const slug of new Set([...Object.keys(kingFromPrior), ...Object.keys(kingPoints)])) {
      kingPoints[slug] = (kingPoints[slug] ?? 0) + (kingFromPrior[slug] ?? 0);
    }
    for (const slug of new Set([...Object.keys(queenFromPrior), ...Object.keys(queenPoints)])) {
      queenPoints[slug] = (queenPoints[slug] ?? 0) + (queenFromPrior[slug] ?? 0);
    }
    for (const slug of Object.keys(kingFromPriorBreakdown)) {
      if (!kingBreakdown[slug]) kingBreakdown[slug] = emptyBreakdown();
      kingBreakdown[slug].qualifier += kingFromPriorBreakdown[slug].qualifier;
      kingBreakdown[slug].semi += kingFromPriorBreakdown[slug].semi;
    }
    for (const slug of Object.keys(queenFromPriorBreakdown)) {
      if (!queenBreakdown[slug]) queenBreakdown[slug] = emptyBreakdown();
      queenBreakdown[slug].qualifier += queenFromPriorBreakdown[slug].qualifier;
      queenBreakdown[slug].semi += queenFromPriorBreakdown[slug].semi;
    }

    // Add tournament points (qualifier + semi from R/S) to PLE total. Do NOT add final/winner here —
    // those are already in totalsByWrestler from the NOC final match (wp.total), so we use breakdown only.
    for (const slug of new Set([
      ...totalsByWrestler.keys(),
      ...Object.keys(kingFromPriorBreakdown),
      ...Object.keys(queenFromPriorBreakdown),
    ])) {
      const current = totalsByWrestler.get(slug) ?? 0;
      const k = kingFromPriorBreakdown[slug];
      const q = queenFromPriorBreakdown[slug];
      const priorTournamentOnly =
        (k?.qualifier ?? 0) + (k?.semi ?? 0) + (q?.qualifier ?? 0) + (q?.semi ?? 0);
      totalsByWrestler.set(slug, current + priorTournamentOnly);
    }
  }

  const displayName = (slug: string) =>
    slugToName.get(slug) ?? formatSlug(slug);

  /** Canonical 16 Queen of the Ring participants for NOC — table shows only these, in this order (then sorted by total desc). */
  const QUEEN_OF_THE_RING_PARTICIPANTS = [
    "Jade Cargill", "Asuka", "Alexa Bliss", "Roxanne Perez", "Charlotte Flair", "Alba Fyre",
    "Candice LeRae", "Stephanie Vaquer", "Raquel Rodriguez", "Ivy Nile", "Kairi Sane",
    "Liv Morgan", "Rhea Ripley", "Michin", "Piper Niven", "Nia Jax",
  ];

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href="/event-results">← Event Results</Link>
        {" · "}
        <Link href="/">Home</Link>
      </p>

      <header
        style={{
          borderBottom: "2px solid #C6A04F",
          paddingBottom: 16,
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: "0 0 4px 0", fontSize: 28 }}>
          {scored.eventName}
        </h1>
        <p style={{ margin: 0, color: "#666", fontSize: 15 }}>
          {formatDate(scored.date ?? null)}
          {scored.eventType && scored.eventType !== "unknown" && (
            <> · {formatEventType(scored.eventType)}</>
          )}
        </p>
      </header>

      {isKOTRPLE && (
        <div
          style={{
            marginBottom: 24,
            padding: 12,
            background: "#f5f5f5",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            fontSize: 13,
            color: "#555",
          }}
        >
          <strong>King/Queen of the Ring:</strong> Qualifier and semi-final matches take place on Raw and SmackDown; those shows award both event points and tournament points (toward this event). Points from R/S are included below. The final at this event adds 10 pts (both finalists) + 20 pts (winner).
        </div>
      )}

      {isKOTRPLE && (
        <section style={{ marginBottom: 24, padding: 16, background: "#f0f8ff", border: "1px solid #b0d0e0", borderRadius: 8, fontSize: 13 }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>KOTR prior events (June 20 / 23)</h3>
          {kotrForceFetchLog.map((r) => (
            <div key={r.id} style={{ margin: "8px 0" }}>
              <p style={{ margin: "4px 0", fontFamily: "monospace", fontSize: 12 }}>
                <strong>{r.id}</strong>: {r.found ? "found" : "not found"}
                {r.error != null && ` · ${r.error}`}
                {r.eventType != null && r.eventType !== "" && !r.eventType.startsWith("(") && ` · type=${r.eventType}`}
                {r.matchCount != null && ` · matches=${r.matchCount}`}
                {r.added != null && r.added.length > 0 && ` · added: ${r.added.join(", ")}`}
                {r.added != null && r.added.length === 0 && r.matchHints == null && r.error == null && " · 0 KOTR pts from any match"}
              </p>
              {r.matchHints != null && r.matchHints.length > 0 && (
                <div style={{ marginLeft: 12, fontSize: 11, color: "#666" }}>
                  Match text (why 0 added): {r.matchHints.map((h, i) => (
                    <div key={i} style={{ marginTop: 2 }}>{h}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {kotrForceFetchLog.length === 0 && <p style={{ margin: 0 }}>No force-fetch log (not a KOTR PLE or no date).</p>}
        </section>
      )}

      {debugKotr && isKOTRPLE && (
        <section style={{ marginBottom: 24, padding: 16, background: "#fffbe6", border: "1px solid #e0c000", borderRadius: 8, fontSize: 13 }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>KOTR debug (prior events)</h3>
          <p style={{ margin: "0 0 8px 0" }}>
            Prior window: <strong>{priorWindowStart}</strong> → <strong>{priorWindowEnd}</strong> · {priorEventCount} events fetched.
          </p>
          <p style={{ margin: "0 0 8px 0" }}>
            queenFromPrior (Asuka / Alexa): <strong>{Object.keys(kotrDebugQueens).filter((k) => /asuka|alexa|bliss/i.test(displayName(k))).map((k) => `${displayName(k)}=${kotrDebugQueens[k]}`).join(", ") || "none"}</strong>
            {" · "}
            All queen: {Object.entries(kotrDebugQueens).map(([k, v]) => `${displayName(k)}=${v}`).join(", ") || "—"}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <th style={{ textAlign: "left", padding: 4 }}>Event id</th>
                <th style={{ textAlign: "left", padding: 4 }}>Date</th>
                <th style={{ textAlign: "left", padding: 4 }}>Type</th>
                <th style={{ textAlign: "left", padding: 4 }}>RS?</th>
                <th style={{ textAlign: "left", padding: 4 }}>KOTR matches</th>
              </tr>
            </thead>
            <tbody>
              {kotrDebugRows.map((r) => (
                <tr key={r.eventId} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 4 }}>{r.eventId}</td>
                  <td style={{ padding: 4 }}>{r.date}</td>
                  <td style={{ padding: 4 }}>{r.eventType}</td>
                  <td style={{ padding: 4 }}>{r.isRS ? "yes" : "no"}</td>
                  <td style={{ padding: 4 }}>{r.matchSummary.length ? r.matchSummary.join("; ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!kotrDebugJune20 && (
            <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#c00" }}>
              June 20 SmackDown not found in prior events. Check that an event with date <strong>2025-06-20</strong> (or id containing <strong>smackdown</strong> and <strong>20250620</strong>) exists and falls within the prior window above.
            </p>
          )}
          {kotrDebugJune20 && (
            <>
              <h4 style={{ margin: "16px 0 8px 0", fontSize: 13 }}>June 20 SmackDown — raw event data</h4>
              <p style={{ margin: 0, fontSize: 12 }}>
                id: <strong>{kotrDebugJune20.eventId}</strong> · date: <strong>{kotrDebugJune20.date}</strong> · name: {kotrDebugJune20.name}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12 }}>Match fields we use for KOTR detection: <code>stipulation</code>, <code>Stipulation</code>, <code>match_type</code>, <code>matchType</code>, <code>title</code>. If your data uses different keys, they won’t be read.</p>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ccc" }}>
                    <th style={{ textAlign: "left", padding: 4 }}>Order</th>
                    <th style={{ textAlign: "left", padding: 4 }}>Keys on match</th>
                    <th style={{ textAlign: "left", padding: 4 }}>Stipulation / type / title</th>
                    <th style={{ textAlign: "left", padding: 4 }}>Participants</th>
                  </tr>
                </thead>
                <tbody>
                  {kotrDebugJune20.matchesInspect.map((row) => (
                    <tr key={row.order} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 4 }}>{row.order}</td>
                      <td style={{ padding: 4 }}>{row.keys.join(", ")}</td>
                      <td style={{ padding: 4 }}>{row.stipulationLike}</td>
                      <td style={{ padding: 4 }}>{row.participantsLike}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <p style={{ margin: "8px 0 0 0", color: "#666" }}>Add <code>?debug=kotr</code> to the URL to see this. Remove it for normal view.</p>
        </section>
      )}

      {isKOTRPLE && Object.keys(kingPoints).length > 0 && (
        <section
          style={{
            marginBottom: 24,
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              background: "#e8e8e8",
              borderBottom: "1px solid #e0e0e0",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            King of the Ring — tournament points
          </div>
          <div style={{ padding: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px 10px 0", fontWeight: 600 }}>Wrestler</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Qualifier (3)</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Semi (7)</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Final (10)</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Winner (20)</th>
                  <th style={{ textAlign: "right", padding: "10px 0", fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(kingPoints)
                  .filter(([slug]) => (queenPoints[slug] ?? 0) === 0)
                  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                  .map(([slug, pts]) => {
                    const bd = kingBreakdown[slug] ?? emptyBreakdown();
                    const total = bd.qualifier + bd.semi + bd.final + bd.winner;
                    return (
                      <tr key={slug} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "10px 12px 10px 0" }}>{displayName(slug)}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right" }}>{bd.qualifier > 0 ? bd.qualifier : "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right" }}>{bd.semi > 0 ? bd.semi : "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right" }}>{bd.final > 0 ? bd.final : "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right" }}>{bd.winner > 0 ? bd.winner : "—"}</td>
                        <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600 }}>{total} pts</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isKOTRPLE && (
        <section
          style={{
            marginBottom: 24,
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              background: "#e8e8e8",
              borderBottom: "1px solid #e0e0e0",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            Queen of the Ring — tournament points
          </div>
          <div style={{ padding: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px 10px 0", fontWeight: 600 }}>Wrestler</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Qualifier (3)</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Semi (7)</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Final (10)</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Winner (20)</th>
                  <th style={{ textAlign: "right", padding: "10px 0", fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {QUEEN_OF_THE_RING_PARTICIPANTS.map((name) => {
                  const slug = normalizeWrestlerName(name) ?? name;
                  const canon = toCanonicalSlug(slug);
                  const bd = queenBreakdown[canon] ?? emptyBreakdown();
                  const total = bd.qualifier + bd.semi + bd.final + bd.winner;
                  return { name, canon, bd, total };
                })
                  .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
                  .map(({ name, canon, bd, total }) => (
                    <tr key={canon} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px 12px 10px 0" }}>{displayName(canon) || name}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>{bd.qualifier > 0 ? bd.qualifier : "—"}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>{bd.semi > 0 ? bd.semi : "—"}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>{bd.final > 0 ? bd.final : "—"}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>{bd.winner > 0 ? bd.winner : "—"}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600 }}>{total} pts</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {scored.matches.length === 0 ? (
        <p>No matches in this event.</p>
      ) : (
        <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {scored.matches.map((match) => (
            <article
              key={match.order}
              style={{
                background: "#f8f8f8",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  background: (match as { isPromo?: boolean }).isPromo ? "#e8e8e8" : "#eee",
                  borderBottom: "1px solid #e0e0e0",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Match {match.order}
                {(match as { isPromo?: boolean }).isPromo && (
                  <span style={{ marginLeft: 8, color: "#888", fontWeight: "normal" }}>
                    — Promo (no points awarded)
                  </span>
                )}
                {match.title && match.title !== "None" && match.title !== "" && !(match as { isPromo?: boolean }).isPromo && (
                  <span style={{ marginLeft: 8, color: "#555" }}>
                    — {String(match.title)}
                  </span>
                )}
              </div>
              <div style={{ padding: 16 }}>
                <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>
                  {replaceSlugsInString(match.participants, slugToName) || match.participants}
                </p>
                {match.result && (
                  <p style={{ margin: "0 0 12px 0", color: "#444", fontSize: 14 }}>
                    {replaceSlugsInString(match.result, slugToName) || match.result}
                    {match.method && (
                      <span style={{ color: "#888" }}> · {match.method}</span>
                    )}
                  </p>
                )}
                {match.titleOutcome && match.titleOutcome !== "None" && (
                  <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#666" }}>
                    {match.titleOutcome}
                  </p>
                )}

                {(match as { isPromo?: boolean }).isPromo ? (
                  <p style={{ margin: "12px 0 0 0", fontSize: 13, color: "#888" }}>
                    No fantasy points are awarded for promo segments.
                  </p>
                ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #ccc" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "8px 12px 8px 0",
                          fontWeight: 600,
                        }}
                      >
                        Wrestler
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 0",
                          fontWeight: 600,
                        }}
                      >
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(match.wrestlerPoints ?? []).map((wp) => {
                      const kotrTowardNOC = (wp as { kotrTowardNOC?: number }).kotrTowardNOC ?? 0;
                      return (
                        <tr key={wp.wrestler} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "10px 12px 10px 0", verticalAlign: "top" }}>
                            <strong>{displayName(wp.wrestler)}</strong>
                            {wp.breakdown && wp.breakdown.length > 0 && (
                              <ul
                                style={{
                                  margin: "4px 0 0 0",
                                  paddingLeft: 18,
                                  color: "#555",
                                  fontSize: 12,
                                  fontWeight: "normal",
                                }}
                              >
                                {wp.breakdown.map((line, i) => (
                                  <li key={i}>{line}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "10px 0",
                              textAlign: "right",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              verticalAlign: "top",
                            }}
                          >
                            <div>{wp.total} pts</div>
                            {kotrTowardNOC > 0 && (
                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 12,
                                  fontWeight: "normal",
                                  color: "#666",
                                }}
                              >
                                +{kotrTowardNOC} toward NOC
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
