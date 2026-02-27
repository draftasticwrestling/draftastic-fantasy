import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueBySlug, getEffectiveLeagueStartDate, getRostersForLeague, getLeagueMembers } from "@/lib/leagues";
import { scoreEvent } from "@/lib/scoring/scoreEvent.js";
import type { ScoredEvent } from "@/lib/scoring/types";
import { aggregateWrestlerPoints } from "@/lib/scoring/aggregateWrestlerPoints.js";
import {
  computeEndOfMonthBeltPoints,
  FIRST_END_OF_MONTH_POINTS_DATE,
  inferReignsFromEvents,
  getTitleReignsForWrestler,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { resolvePersonaToCanonical } from "@/lib/scoring/personaResolution.js";
import { EVENT_TYPES } from "@/lib/scoring/parsers/eventClassifier.js";
import { WrestlerPointsPeriodSelector, type PointsPeriod } from "./WrestlerPointsPeriodSelector";

const EVENTS_FROM_DATE = "2020-01-01";

function firstMonthEndOnOrAfter(startDate: string): string {
  const d = new Date(startDate + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.toISOString().slice(0, 10);
}

function filterEventsByPeriod(
  events: { id: string; name: string | null; date: string | null; matches: unknown }[],
  period: PointsPeriod,
  leagueStartDate: string | null
): { id: string; name: string | null; date: string | null; matches: unknown }[] {
  if (period === "allTime") return events;
  if (period === "2025") return events.filter((e) => e.date && e.date >= "2025-01-01" && e.date <= "2025-12-31");
  if (period === "2026") return events.filter((e) => e.date && e.date >= "2026-01-01" && e.date <= "2026-12-31");
  if (period === "sinceStart") return leagueStartDate ? events.filter((e) => e.date && e.date >= leagueStartDate) : [];
  return events;
}

function getFirstMonthEndForPeriod(period: PointsPeriod, leagueStartDate: string | null): string {
  if (period === "sinceStart" && leagueStartDate) return firstMonthEndOnOrAfter(leagueStartDate);
  if (period === "2025") return "2025-01-31";
  if (period === "2026") return "2026-01-31";
  return FIRST_END_OF_MONTH_POINTS_DATE;
}

function getPeriodLabel(period: PointsPeriod): string {
  if (period === "allTime") return "all-time";
  if (period === "2025") return "2025";
  if (period === "2026") return "2026";
  return "since league start";
}
const BOXSCORE_WRESTLER_BASE = "https://prowrestlingboxscore.com/wrestlers";

type ChampionshipReign = {
  champion_slug?: string | null;
  champion_id?: string | null;
  champion?: string | null;
  champion_name?: string | null;
  title?: string | null;
  title_name?: string | null;
  won_date?: string | null;
  start_date?: string | null;
  lost_date?: string | null;
  end_date?: string | null;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = (dateStr || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long" });
    return `${month} ${day}, ${y}`;
  }
  return dateStr;
}

function formatMonthEnd(monthEnd: string): string {
  const [y, m] = monthEnd.split("-");
  const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long" });
  return `${month} ${y}`;
}

function calculateAge(dob: string | null | undefined): number | null {
  if (!dob || !dob.trim()) return null;
  const date = new Date(dob);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  return age >= 0 ? age : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: wrestler } = await supabase
    .from("wrestlers")
    .select("name")
    .eq("id", slug)
    .single();
  const name = wrestler?.name ?? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    title: `${name} — Wrestler — Draftastic Fantasy`,
    description: `Fantasy stats and match history for ${name}.`,
  };
}

export default async function WrestlerProfilePage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ period?: string; league?: string }>;
}) {
  const { slug } = await params;
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};
  const periodParam = (searchParams.period ?? "").trim() as PointsPeriod | "";
  const leagueSlugParam = (searchParams.league ?? "").trim() || null;

  const league = leagueSlugParam ? await getLeagueBySlug(leagueSlugParam) : null;
  const leagueStartDate = league ? getEffectiveLeagueStartDate(league) : null;

  let rosterOwner: { userId: string; label: string } | null = null;
  if (league) {
    const [rosters, members] = await Promise.all([getRostersForLeague(league.id), getLeagueMembers(league.id)]);
    for (const [uid, entries] of Object.entries(rosters ?? {})) {
      const hasWrestler = (entries ?? []).some((e) => String(e.wrestler_id).toLowerCase() === String(slug).toLowerCase());
      if (hasWrestler) {
        const m = members?.find((x) => x.user_id === uid);
        rosterOwner = {
          userId: uid,
          label: (m?.team_name?.trim() || m?.display_name?.trim() || "Unknown").trim() || "Unknown",
        };
        break;
      }
    }
  }
  const currentPeriod: PointsPeriod =
    periodParam && (periodParam === "allTime" || periodParam === "2025" || periodParam === "2026" || periodParam === "sinceStart")
      ? periodParam
      : leagueSlugParam
        ? "sinceStart"
        : "allTime";

  const { data: wrestler, error: wrestlerError } = await supabase
    .from("wrestlers")
    .select("id, name, gender, brand, image_url, dob")
    .eq("id", slug)
    .single();

  if (wrestlerError || !wrestler) notFound();

  const { data: eventsBase } = await supabase
    .from("events")
    .select("id, name, date, matches")
    .eq("status", "completed")
    .gte("date", EVENTS_FROM_DATE)
    .order("date", { ascending: true });

  const knownEventIds = ["raw-20250714-1753144554675"];
  const knownKotrPriorIds = ["smackdown-20250620", "raw-20250623"];
  const existingIds = new Set((eventsBase ?? []).map((e) => e.id));
  const toFetch = knownEventIds.filter((id) => !existingIds.has(id));
  const toFetchKotr = knownKotrPriorIds.filter((id) => !existingIds.has(id));
  let extra: { id: string; name: string | null; date: string | null; matches: unknown }[] = [];
  if (toFetch.length > 0) {
    const res = await supabase
      .from("events")
      .select("id, name, date, matches")
      .in("id", toFetch)
      .eq("status", "completed");
    extra = (res.data ?? []) as typeof extra;
  }
  let kotrPriorEvents: { id: string; name: string | null; date: string | null; matches: unknown }[] = [];
  if (toFetchKotr.length > 0) {
    const res = await supabase
      .from("events")
      .select("id, name, date, matches")
      .in("id", toFetchKotr);
    kotrPriorEvents = (res.data ?? []) as typeof kotrPriorEvents;
  }
  const allEvents = [...(eventsBase ?? []), ...extra, ...kotrPriorEvents].sort(
    (a, b) => (a.date ?? "").localeCompare(b.date ?? "")
  );
  const events = filterEventsByPeriod(allEvents, currentPeriod, leagueStartDate);
  const firstMonthEnd = getFirstMonthEndForPeriod(currentPeriod, leagueStartDate);

  const { data: rawReigns } = await supabase
    .from("championship_history")
    .select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date")
    .order("won_date", { ascending: true });
  const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
  const eventsWithDate = (events ?? []).filter((e): e is typeof e & { date: string } => e.date != null);
  const inferredReigns = inferReignsFromEvents(
    eventsWithDate as { date: string; matches?: Array<{ title?: string; titleOutcome?: string; result?: string; participants?: string }> }[]
  );
  const reigns = tableReigns.length > 0 ? tableReigns : inferredReigns;

  const pointsBySlug = aggregateWrestlerPoints(
    (events ?? []) as { id: string; name: string; date: string; matches?: object[] }[]
  );
  const endOfMonthBySlug = computeEndOfMonthBeltPoints(reigns, firstMonthEnd);
  const nameKey = wrestler.name ? normalizeWrestlerName(wrestler.name) : "";
  const extraBelt =
    (typeof endOfMonthBySlug[slug] === "number" ? endOfMonthBySlug[slug] : null) ??
    (nameKey && typeof endOfMonthBySlug[nameKey] === "number" ? endOfMonthBySlug[nameKey] : null) ??
    0;

  const points = pointsBySlug[slug] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
  const beltPoints = points.beltPoints + extraBelt;
  const totalPoints = points.rsPoints + points.plePoints + beltPoints;

  const titleReigns = getTitleReignsForWrestler(reigns, firstMonthEnd, slug);

  const { data: wrestlersList } = await supabase.from("wrestlers").select("id, name");
  const slugToCanonical = new Map<string, string>();
  for (const w of wrestlersList ?? []) {
    const id = (w.id ?? "").toString().trim();
    const name = (w.name ?? "").toString().trim();
    if (id) {
      const normId = normalizeWrestlerName(id);
      const normName = normalizeWrestlerName(name);
      if (normId) slugToCanonical.set(normId, id);
      if (normName) slugToCanonical.set(normName, id);
    }
  }
  function toCanonicalSlug(s: string): string {
    return slugToCanonical.get(s) ?? s;
  }
  const canonicalSlug = toCanonicalSlug(slug) || toCanonicalSlug(nameKey) || slug;

  type KotrBreakdown = { qualifier: number; semi: number };
  const emptyBreakdown = (): KotrBreakdown => ({ qualifier: 0, semi: 0 });
  const kingFromPriorBreakdown: Record<string, KotrBreakdown> = {};
  const queenFromPriorBreakdown: Record<string, KotrBreakdown> = {};
  let nocEventId: string | null = null;
  let nocDateMs = 0;
  for (const ev of events ?? []) {
    const s = scoreEvent(ev) as ScoredEvent;
    const isNOC =
      s.eventType === EVENT_TYPES.NIGHT_OF_CHAMPIONS ||
      s.eventType === EVENT_TYPES.KING_QUEEN_OF_THE_RING;
    if (isNOC && ev.date) {
      nocEventId = ev.id;
      nocDateMs = new Date(ev.date).getTime();
      break;
    }
  }
  if (nocEventId && nocDateMs > 0) {
    for (const ev of events ?? []) {
      const d = ev.date ? new Date(ev.date).getTime() : 0;
      if (d >= nocDateMs) continue;
      const forceScored = scoreEvent(ev) as ScoredEvent;
      const isRS =
        forceScored.eventType === EVENT_TYPES.RAW ||
        forceScored.eventType === EVENT_TYPES.SMACKDOWN;
      if (!isRS) continue;
      for (const m of forceScored.matches ?? []) {
        if ((m as { isPromo?: boolean }).isPromo || !m.wrestlerPoints) continue;
        for (const wp of m.wrestlerPoints) {
          const toward = (wp as { kotrTowardNOC?: number }).kotrTowardNOC ?? 0;
          const bracket = (wp as { kotrBracket?: string | null }).kotrBracket ?? "king";
          const round = (wp as { kotrRound?: string | null }).kotrRound ?? (toward === 7 ? "semi" : "first");
          if (toward <= 0) continue;
          const participantSlug = wp.wrestler ? normalizeWrestlerName(wp.wrestler) : "";
          if (!participantSlug) continue;
          const eventDate = (ev as { date?: string }).date ? String((ev as { date?: string }).date).slice(0, 10) : "";
          const canon = resolvePersonaToCanonical(participantSlug, eventDate) ?? toCanonicalSlug(participantSlug);
          if (bracket === "queen") {
            const bd = queenFromPriorBreakdown[canon] ?? emptyBreakdown();
            queenFromPriorBreakdown[canon] = bd;
            const atQualifierCap = bd.qualifier >= 3;
            const atSemiCap = bd.semi >= 7;
            if (round === "first" && !atQualifierCap) {
              bd.qualifier += 3;
            } else if (round === "semi" && !atSemiCap) {
              bd.semi += 7;
            }
          } else {
            const bd = kingFromPriorBreakdown[canon] ?? emptyBreakdown();
            kingFromPriorBreakdown[canon] = bd;
            const atQualifierCap = bd.qualifier >= 3;
            const atSemiCap = bd.semi >= 7;
            if (round === "first" && !atQualifierCap) {
              bd.qualifier += 3;
            } else if (round === "semi" && !atSemiCap) {
              bd.semi += 7;
            }
          }
        }
      }
    }
  }

  type MatchRow = {
    eventId: string;
    eventName: string;
    date: string;
    result: string | null;
    title: string | null;
    titleOutcome: string | null;
    total: number;
    breakdown: string[];
    personaName: string | null;
  };
  const eventToRow = new Map<
    string,
    { eventName: string; date: string; total: number; result: string | null; title: string | null; titleOutcome: string | null; personaName: string | null }
  >();

  function participantMatchesWrestler(participantSlug: string, eventDate: string): boolean {
    if (!participantSlug) return false;
    const resolved = resolvePersonaToCanonical(participantSlug, eventDate);
    if (resolved && (resolved === slug || resolved === nameKey)) return true;
    if (participantSlug === slug || participantSlug === nameKey) return true;
    const slugNorm = slug.replace(/-/g, "");
    const partNorm = participantSlug.replace(/-/g, "");
    if (slugNorm && partNorm && slugNorm === partNorm) return true;
    if (participantSlug.includes(slug) && (participantSlug === slug || participantSlug.startsWith(slug + "-") || participantSlug.endsWith("-" + slug))) return true;
    if (slug.includes(participantSlug) && (slug === participantSlug || slug.startsWith(participantSlug + "-") || slug.endsWith("-" + participantSlug))) return true;
    return false;
  }

  for (const event of events ?? []) {
    const scored = scoreEvent(event) as ScoredEvent;
    const eventId = event.id;
    const eventName = scored.eventName ?? event.name ?? "";
    const date = (event.date || "").slice(0, 10);
    const isRS =
      scored.eventType === EVENT_TYPES.RAW ||
      scored.eventType === EVENT_TYPES.SMACKDOWN;
    const isKOTRPLE =
      scored.eventType === EVENT_TYPES.NIGHT_OF_CHAMPIONS ||
      scored.eventType === EVENT_TYPES.KING_QUEEN_OF_THE_RING;
    let eventTotal = 0;
    let firstResult: string | null = null;
    let firstTitle: string | null = null;
    let firstTitleOutcome: string | null = null;
    let firstPersonaName: string | null = null;
    for (const m of scored.matches ?? []) {
      if (m.isPromo || !m.wrestlerPoints) continue;
        for (const wp of m.wrestlerPoints) {
        const participantSlug = wp.wrestler ? normalizeWrestlerName(wp.wrestler) : "";
        if (!participantMatchesWrestler(participantSlug, date)) continue;
        const resolved = resolvePersonaToCanonical(participantSlug, date);
        const earnedAsPersona = resolved && (resolved === slug || resolved === nameKey) && participantSlug !== slug && participantSlug !== nameKey;
        if (earnedAsPersona && wp.wrestler && !firstPersonaName) {
          firstPersonaName = String(wp.wrestler).trim();
        }
        const matchPt = (wp as { matchPoints?: number }).matchPoints ?? 0;
        const mainPt = (wp as { mainEventPoints?: number }).mainEventPoints ?? 0;
        const titlePt = (wp as { titlePoints?: number }).titlePoints ?? 0;
        const specialPt = (wp as { specialPoints?: number }).specialPoints ?? 0;
        const brPt = (wp as { battleRoyalPoints?: number }).battleRoyalPoints ?? 0;
        if (isRS) {
          eventTotal += matchPt + mainPt + titlePt + brPt;
        } else {
          eventTotal += matchPt + mainPt + titlePt + specialPt + brPt;
        }
        if (firstResult === null && (wp.total ?? 0) > 0) {
          firstResult = m.result ?? null;
          firstTitle = m.title ?? null;
          firstTitleOutcome = m.titleOutcome ?? null;
        }
      }
    }
    let total = eventTotal;
    if (eventId === nocEventId) {
      const k = kingFromPriorBreakdown[canonicalSlug] ?? emptyBreakdown();
      const q = queenFromPriorBreakdown[canonicalSlug] ?? emptyBreakdown();
      total = eventTotal + k.qualifier + k.semi + q.qualifier + q.semi;
    }
    if (total > 0) {
      eventToRow.set(eventId, {
        eventName,
        date,
        total,
        result: firstResult,
        title: firstTitle,
        titleOutcome: firstTitleOutcome,
        personaName: firstPersonaName,
      });
    }
  }

  const matchesWithPoints: MatchRow[] = [...eventToRow.entries()].map(([eventId, row]) => ({
    eventId,
    eventName: row.eventName,
    date: row.date,
    result: row.result,
    title: row.title,
    titleOutcome: row.titleOutcome,
    total: row.total,
    breakdown: [],
    personaName: row.personaName,
  }));
  matchesWithPoints.sort((a, b) => b.date.localeCompare(a.date));

  const displayName = wrestler.name ?? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const age = calculateAge(wrestler.dob);
  const boxscoreUrl = `${BOXSCORE_WRESTLER_BASE}/${slug}`;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900, margin: "0 auto", fontSize: 16, lineHeight: 1.5 }}>
      <p style={{ marginBottom: 20 }}>
        <Link href="/wrestlers" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Wrestlers
        </Link>
      </p>

      <section style={{ display: "flex", gap: 24, alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap" }}>
        <div>
          {wrestler.image_url ? (
            <img
              src={wrestler.image_url}
              alt={displayName}
              style={{ width: 120, height: 120, objectFit: "cover", borderRadius: "50%", background: "#333" }}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "#ddd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
                fontSize: 32,
              }}
            >
              —
            </div>
          )}
        </div>
        <div style={{ flex: "1 1 300px" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: "1.75rem", fontWeight: 700 }}>
            {displayName}
          </h1>
          <p style={{ margin: "0 0 4px", color: "#555" }}>
            {wrestler.brand ?? "—"} · {wrestler.gender ? (String(wrestler.gender).toLowerCase() === "male" || wrestler.gender === "M" ? "Male" : "Female") : "—"}
            {age != null ? ` · ${age} years old` : ""}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 12 }}>
            {rosterOwner && leagueSlugParam ? (
              <Link
                href={`/leagues/${encodeURIComponent(leagueSlugParam)}/team?proposeTradeTo=${encodeURIComponent(rosterOwner.userId)}#propose-trade`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 14px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1a1a1a",
                  background: "#e5e5e5",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M13 5H4M4 5L6 3M4 5l2 2" />
                  <path d="M3 11h9M12 11l-2-2M12 11l-2 2" />
                </svg>
                Trade with {rosterOwner.label}
              </Link>
            ) : (
              <>
                {leagueSlugParam && (
                  <Link
                    href={`/leagues/${encodeURIComponent(leagueSlugParam)}/team?addFa=${encodeURIComponent(slug)}#sign-free-agent`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      background: "var(--color-blue)",
                      border: "none",
                      borderRadius: 6,
                      textDecoration: "none",
                    }}
                  >
                    + Add
                  </Link>
                )}
                <Link
                  href={leagueSlugParam ? `/leagues/${encodeURIComponent(leagueSlugParam)}/watchlist?add=${encodeURIComponent(slug)}` : `/wrestlers/watch?add=${encodeURIComponent(slug)}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "8px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--color-text)",
                    background: "transparent",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    textDecoration: "none",
                  }}
                >
                  ⚑ Watchlist
                </Link>
              </>
            )}
          </div>
          <p style={{ marginTop: 16 }}>
            <a
              href={boxscoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#1a73e8", textDecoration: "none" }}
            >
              View profile on Pro Wrestling Boxscore →
            </a>
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <WrestlerPointsPeriodSelector currentPeriod={currentPeriod} leagueSlug={leagueSlugParam} />
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 12 }}>
          Points ({getPeriodLabel(currentPeriod)})
        </h2>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ padding: "12px 20px", background: "#f5f5f5", borderRadius: 8 }}>
            <span style={{ color: "#666", fontSize: 14 }}>R/S Points</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{points.rsPoints}</div>
          </div>
          <div style={{ padding: "12px 20px", background: "#f5f5f5", borderRadius: 8 }}>
            <span style={{ color: "#666", fontSize: 14 }}>PLE Points</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{points.plePoints}</div>
          </div>
          <div style={{ padding: "12px 20px", background: "#f5f5f5", borderRadius: 8 }}>
            <span style={{ color: "#666", fontSize: 14 }}>Belt Points</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{beltPoints}</div>
            {extraBelt > 0 && (
              <span style={{ fontSize: 12, color: "#666" }}>({points.beltPoints} match + {extraBelt} monthly)</span>
            )}
          </div>
          <div style={{ padding: "12px 20px", background: "#1a1a1a", color: "#fff", borderRadius: 8 }}>
            <span style={{ opacity: 0.9, fontSize: 14 }}>Total Points</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalPoints}</div>
          </div>
        </div>
      </section>

      {titleReigns.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 12 }}>Title reigns (months held)</h2>
          <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #ddd" }}>Title</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #ddd" }}>Months held (end of month)</th>
                </tr>
              </thead>
              <tbody>
                {titleReigns.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.title}</td>
                    <td style={{ padding: "10px 12px", color: "#555" }}>
                      {r.monthEnds.map(formatMonthEnd).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 12 }}>
          Events with points ({matchesWithPoints.length})
        </h2>
        {matchesWithPoints.length === 0 ? (
          <p style={{ color: "#666" }}>No matches with points in the league period.</p>
        ) : (
          <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #ddd" }}>Date</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #ddd" }}>Event</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #ddd" }}>Result / Title</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", borderBottom: "1px solid #ddd" }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {matchesWithPoints.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{formatDate(row.date)}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <Link href={`/event-results/${row.eventId}`} style={{ color: "#1a73e8", textDecoration: "none" }}>
                        {row.eventName}
                      </Link>
                      {row.personaName && (
                        <span style={{ display: "block", fontSize: 12, color: "#666", fontStyle: "italic" }}>
                          as {row.personaName}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#333" }}>
                      {row.result ?? "—"}
                      {row.title && row.title !== "None" && (
                        <span style={{ display: "block", fontSize: 12, color: "#666" }}>
                          {row.title}
                          {row.titleOutcome && row.titleOutcome !== "None" ? ` · ${row.titleOutcome}` : ""}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
