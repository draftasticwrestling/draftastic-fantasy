import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ComponentType } from "react";
import MatchCardUntyped from "@/components/boxscore-port/MatchCard";
import MatchPageHero from "@/components/boxscore-port/MatchPageHero";
import MatchCardTabsSection from "@/components/boxscore-port/MatchCardTabsSection";
import { getSortedMatchesForEvent } from "@/components/boxscore-port/utils/eventMatchesOrder";
import { shouldUseMatchDetailPage } from "@/components/boxscore-port/utils/matchDetailPageEligibility";
import { buildMatchPageHeadline, shouldUseEnhancedMatchPage } from "@/components/boxscore-port/utils/matchPageLayout";
import { buildWrestlerMap } from "@/lib/boxscore/normalizeWrestlerForCard";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import {
  buildEventResultsSlug,
  eventResultsHref,
  getEventForResultsRoute,
} from "@/lib/event-results/eventResultsRoute";
import { supabase } from "@/lib/supabase";

const MatchCard = MatchCardUntyped as ComponentType<{
  match: unknown;
  event: Record<string, unknown>;
  wrestlerMap: Record<string, Record<string, unknown>>;
  isClickable?: boolean;
  matchIndex?: number;
  events: Record<string, unknown>[];
  fantasyPointsBySlug?: Record<string, { points: number; isWinner: boolean; breakdown: string[] }> | null;
}>;

export const dynamic = "force-dynamic";

type Params = { eventId: string; matchNumber: string };

export default async function EventMatchDetailPage({ params }: { params: Promise<Params> }) {
  const { eventId, matchNumber } = await params;
  const event = await getEventForResultsRoute(eventId);
  if (!event) notFound();

  const canonicalSlug = buildEventResultsSlug(event);
  const decodedEventParam = decodeURIComponent(eventId.trim());
  if (decodedEventParam !== canonicalSlug) {
    redirect(`/event-results/${canonicalSlug}/match/${encodeURIComponent(matchNumber)}`);
  }

  const indexRaw = Number.parseInt(String(matchNumber), 10);
  if (!Number.isFinite(indexRaw) || indexRaw < 1) notFound();

  const sorted = getSortedMatchesForEvent(event as Record<string, unknown>);
  const matchIndex = indexRaw - 1;
  const match = sorted[matchIndex];
  if (!match) notFound();

  if (!shouldUseMatchDetailPage(match)) {
    redirect(`${eventResultsHref(event)}?match=${indexRaw}`);
  }

  const [{ data: wrestlerRows }, { data: eventsForStats }] = await Promise.all([
    supabase.from("wrestlers").select("id, name, image_url, full_body_image_url, nationality, dob"),
    supabase
      .from("events")
      .select("id, name, date, status, matches")
      .in("status", [...EVENT_STATUSES_FOR_SCORING])
      .order("date", { ascending: false })
      .limit(180),
  ]);

  const wrestlerMap = buildWrestlerMap(wrestlerRows ?? []);
  const statsEventIds = new Set((eventsForStats ?? []).map((e) => String(e.id ?? "")));
  const statsEventsMerged = [...(eventsForStats ?? [])];
  if (event?.id != null && !statsEventIds.has(String(event.id))) {
    statsEventsMerged.push(event);
  }

  const { scoreEvent } = await import("@/lib/scoring/scoreEvent.js");
  const { normalizeWrestlerName } = await import("@/lib/scoring/parsers/participantParser.js");
  const scored = scoreEvent(event) as { matches?: unknown[] };

  const slugToCanonical = new Map<string, string>();
  for (const w of wrestlerRows ?? []) {
    const id = String((w as { id?: string | null }).id ?? "").trim();
    const name = String((w as { name?: string | null }).name ?? "").trim();
    if (!id) continue;
    const idNorm = normalizeWrestlerName(id);
    const nameNorm = normalizeWrestlerName(name);
    if (idNorm) slugToCanonical.set(idNorm, id);
    if (nameNorm) slugToCanonical.set(nameNorm, id);
  }
  const toCanonicalSlug = (slug: string) => slugToCanonical.get(slug) ?? slug;

  const fantasyPointsBySlugByOrder: Record<
    number,
    Record<string, { points: number; isWinner: boolean; breakdown: string[] }>
  > = {};

  const matches = Array.isArray(scored.matches) ? scored.matches : [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i] as {
      order?: number;
      wrestlerPoints?: { wrestler: string; total?: number; breakdown?: unknown }[];
      winners?: string[];
    };
    const order = typeof m.order === "number" ? m.order : i + 1;
    fantasyPointsBySlugByOrder[order] = {};
    for (const wp of m.wrestlerPoints ?? []) {
      const raw = String(wp.wrestler ?? "").trim();
      const slug = normalizeWrestlerName(raw);
      const canon = toCanonicalSlug(slug);
      const winnerNorm = new Set((m.winners ?? []).map((w) => normalizeWrestlerName(String(w))));
      const breakdown = Array.isArray(wp.breakdown)
        ? wp.breakdown.filter((x): x is string => typeof x === "string")
        : [];
      const entry = {
        points: Number(wp.total ?? 0),
        isWinner: winnerNorm.has(slug),
        breakdown,
      };
      fantasyPointsBySlugByOrder[order][canon] = entry;
      if (slug && slug !== canon) fantasyPointsBySlugByOrder[order][slug] = entry;
      if (raw && raw !== slug && raw !== canon) fantasyPointsBySlugByOrder[order][raw] = entry;
    }
  }

  const selectedOrder = typeof match?.order === "number" ? match.order : matchIndex + 1;
  const fantasyPointsBySlug = fantasyPointsBySlugByOrder[selectedOrder] ?? {};
  const typedMatch = match as Record<string, unknown>;
  const hasSummary = Boolean(
    typedMatch?.summary || (typedMatch?.matchType === "Promo" && typedMatch?.notes)
  );
  const summaryContent =
    typedMatch?.matchType === "Promo"
      ? String(typedMatch?.notes ?? "")
      : String(typedMatch?.summary ?? "");
  const headline = buildMatchPageHeadline({
    ...typedMatch,
    eventName: event.name ?? "Event",
  });
  const useEnhanced = shouldUseEnhancedMatchPage(typedMatch, wrestlerMap);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 1200,
        margin: "0 auto",
        background: "#181511",
        minHeight: "100vh",
        color: "#e8e8e8",
      }}
    >
      <p style={{ marginBottom: 16 }}>
        <Link href={eventResultsHref(event)} className="app-link">
          ← Back to event results
        </Link>
      </p>
      <h1 style={{ marginTop: 0, marginBottom: 16, fontSize: "1.35rem", color: "#fff" }}>
        {headline}
      </h1>
      {useEnhanced ? (
        <>
          <MatchPageHero
            match={typedMatch}
            event={event as unknown as Record<string, unknown>}
            wrestlerMap={wrestlerMap}
            events={statsEventsMerged as unknown as Record<string, unknown>[]}
            matchIndex={matchIndex}
          />
          <div
            style={{
              background: "#232323",
              borderRadius: 12,
              border: "1px solid #444",
              boxShadow: "0 0 12px #C6A04F22",
              padding: "18px 24px",
              marginBottom: 24,
            }}
          >
            <MatchCardTabsSection
              match={typedMatch}
              event={{ id: event.id, name: event.name }}
              wrestlerMap={wrestlerMap}
              events={statsEventsMerged as unknown as Record<string, unknown>[]}
              matchIndex={matchIndex}
              royalRumbleHighlights={null}
              summaryContent={summaryContent}
              hasSummary={hasSummary}
              statisticsExtraHint="Last 5 and calendar-year records are shown above each competitor."
              standalone
            />
          </div>
        </>
      ) : (
        <MatchCard
          match={match}
          event={event as unknown as Record<string, unknown>}
          wrestlerMap={wrestlerMap}
          matchIndex={matchIndex}
          events={statsEventsMerged as unknown as Record<string, unknown>[]}
          isClickable={false}
          fantasyPointsBySlug={fantasyPointsBySlug}
        />
      )}
    </main>
  );
}

