import { supabase } from "@/lib/supabase";
import { notFound, permanentRedirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";

import { EventResultsMatchScroll } from "./EventResultsMatchScroll";

import { BoxscoreAdminQuickLinks } from "@/app/components/BoxscoreAdminQuickLinks";
import { EventPageHeader } from "@/components/boxscore-port/EventPageHeader";
import EventBoxscoreMatchList from "@/components/boxscore-port/EventBoxscoreMatchList";
import {
  buildEventHeaderMetaDescription,
  buildEventSeoTitle,
  buildTitleShow,
  formatBroadcastDateTime,
  formatEventHeaderDateLong,
} from "@/lib/boxscore/eventShowHeader";
import { buildWrestlerMap } from "@/lib/boxscore/normalizeWrestlerForCard";
import { buildEventResultsSlug, getEventForResultsRoute } from "@/lib/event-results/eventResultsRoute";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import { isWrestlerWinner } from "@/lib/event-results/winnerUtils";
import type { ScoredEvent } from "@/lib/scoring/types";
import { SEO_DEFAULT_OG_IMAGE_PATH, SEO_SITE_NAME } from "@/lib/seoDefaults";

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getEventForResultsRoute(eventId);
  if (!event?.name) {
    const title = "Event results — Draftastic Fantasy";
    const description = "Fantasy scoring for WWE events.";
    return {
      title,
      description,
      openGraph: {
        type: "website",
        title,
        description,
        siteName: SEO_SITE_NAME,
        images: [{ url: SEO_DEFAULT_OG_IMAGE_PATH, alt: `${title} — ${SEO_SITE_NAME}` }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [SEO_DEFAULT_OG_IMAGE_PATH],
      },
    };
  }
  const canonicalSlug = buildEventResultsSlug(event);
  const title = buildEventSeoTitle(event);
  const description = buildEventHeaderMetaDescription(event);
  const path = `/event-results/${canonicalSlug}`;
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: path,
      siteName: SEO_SITE_NAME,
      images: [
        {
          url: SEO_DEFAULT_OG_IMAGE_PATH,
          alt: `${title} — ${SEO_SITE_NAME}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SEO_DEFAULT_OG_IMAGE_PATH],
    },
  };
}

export default async function EventResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await getEventForResultsRoute(eventId);
  if (!event) {
    notFound();
  }
  if ((event.status ?? "").toLowerCase() === "live") {
    // Keep live cards uncached while a show is in progress.
    noStore();
  }

  const canonicalSlug = buildEventResultsSlug(event);
  const decodedParam = decodeURIComponent(eventId.trim());
  if (decodedParam !== canonicalSlug) {
    permanentRedirect(`/event-results/${canonicalSlug}`);
  }

  const [{ data: wrestlerRows }, { data: eventsForStats }] = await Promise.all([
    supabase
      .from("wrestlers")
      .select("id, name, image_url, full_body_image_url, nationality, dob"),
    supabase
      .from("events")
      .select("id, name, date, status, matches")
      .in("status", [...EVENT_STATUSES_FOR_SCORING])
      .order("date", { ascending: false })
      .limit(180),
  ]);

  const { scoreEvent } = await import("@/lib/scoring/scoreEvent.js");
  const { normalizeWrestlerName } = await import("@/lib/scoring/parsers/participantParser.js");
  const slugToName = new Map<string, string>();
  const slugToCanonical = new Map<string, string>();
  for (const w of wrestlerRows ?? []) {
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

  const wrestlerMap = buildWrestlerMap(wrestlerRows ?? []);

  const statsEventIds = new Set((eventsForStats ?? []).map((e) => String(e.id ?? "")));
  const statsEventsMerged = [...(eventsForStats ?? [])];
  if (event?.id != null && !statsEventIds.has(String(event.id))) {
    statsEventsMerged.push(event);
  }

  const scored = scoreEvent(event) as ScoredEvent;

  const rawMatches = (event.matches || []) as { order?: number }[];

    // Must match EventBoxscoreMatchList + getSortedMatchesForEvent: default order is index+1 when missing,
  // not 0 — otherwise matches without `order` (often main event) get points under 0 while the card looks up N.
  const fantasyPointsBySlugByOrder: Record<
    number,
    Record<string, { points: number; isWinner: boolean; breakdown: string[] }>
  > = {};
  for (let mi = 0; mi < scored.matches.length; mi++) {
    const match = scored.matches[mi];
    const mo = typeof match.order === "number" ? match.order : null;
    const rawM =
      mo != null ? rawMatches.find((r) => Number((r as { order?: number }).order) === mo) : null;
    const rawFallback = rawM ?? rawMatches[mi];
    const order =
      typeof rawFallback?.order === "number"
        ? rawFallback.order
        : mo != null
          ? mo
          : mi + 1;
    fantasyPointsBySlugByOrder[order] = {};
    if (!match.wrestlerPoints) continue;
    for (const wp of match.wrestlerPoints ?? []) {
      const slug = normalizeWrestlerName(wp.wrestler) || wp.wrestler;
      const canon = toCanonicalSlug(slug);
      const raw = String(wp.wrestler ?? "").trim();
      const bd = (wp as { breakdown?: unknown }).breakdown;
      const breakdown = Array.isArray(bd) ? bd.filter((x): x is string => typeof x === "string") : [];
      const entry = {
        points: wp.total ?? 0,
        isWinner: isWrestlerWinner(
          wp.wrestler,
          (match as { winners?: unknown[] }).winners,
          normalizeWrestlerName
        ),
        breakdown,
      };
      fantasyPointsBySlugByOrder[order][canon] = entry;
      if (slug && slug !== canon) fantasyPointsBySlugByOrder[order][slug] = entry;
      if (raw && raw !== canon && raw !== slug) fantasyPointsBySlugByOrder[order][raw] = entry;
    }
  }

  const evExtras = event as typeof event & {
    preview?: string | null;
    recap?: string | null;
    broadcast_start_ts?: string | null;
  };
  const formattedHeaderDate = formatEventHeaderDateLong(event.date);
  const titleShowLine = buildTitleShow(event);

  return (
    <main className="event-results-detail">
      <Suspense fallback={null}>
        <EventResultsMatchScroll />
      </Suspense>
      <BoxscoreAdminQuickLinks eventId={event.id} />
      <EventPageHeader
        eventName={event.name ?? "Event"}
        eventId={event.id}
        h1Text={`${titleShowLine} Results — ${formattedHeaderDate}`}
        metaLine={buildEventHeaderMetaDescription(event)}
        formattedDateLong={formattedHeaderDate}
        location={event.location?.trim() || null}
        broadcastFormatted={formatBroadcastDateTime(evExtras.broadcast_start_ts ?? null)}
        preview={evExtras.preview ?? null}
        recap={evExtras.recap ?? null}
        statusIsCompleted={(event.status || "") === "completed"}
        isLive={event.status === "live"}
      />

            {scored.matches.length === 0 ? (
        <p style={{ color: "#ccc" }}>No matches in this event.</p>
      ) : (
        <>
          <h3 style={{ marginTop: 24, marginBottom: 16, color: "#fff" }}>Match Results</h3>
          <EventBoxscoreMatchList
            event={event}
            wrestlerMap={wrestlerMap}
            events={statsEventsMerged}
            fantasyPointsBySlugByOrder={fantasyPointsBySlugByOrder}
          />
        </>
      )}
    </main>
  );
}
