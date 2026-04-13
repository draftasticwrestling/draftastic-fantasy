"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatEventResultsListMetaLine,
  getEventLogoPath,
  getEventResultsCardTitle,
  getEventShowType,
  type EventShowFilter,
} from "@/lib/boxscore/eventShowHeader";
import type { EventListingRow } from "@/lib/event-results/listingQueries";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";

import styles from "./event-results.module.css";

const PAGE_SIZE = 50;

type Props = {
  initialEvents: EventListingRow[];
  initialHasMore: boolean;
  showFilter: EventShowFilter | null;
};

export function CompletedEventResultsList({ initialEvents, initialHasMore, showFilter }: Props) {
  const [events, setEvents] = useState<EventListingRow[]>(initialEvents);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEvents(initialEvents);
    setHasMore(initialHasMore);
    setError(null);
  }, [initialEvents, initialHasMore]);

  const list = useMemo(
    () => (showFilter ? events.filter((e) => getEventShowType(e) === showFilter) : events),
    [events, showFilter]
  );

  const loadOlder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = events.length;
      const res = await fetch(`/api/event-results/completed?offset=${offset}&limit=${PAGE_SIZE}`);
      const data = (await res.json()) as { events?: EventListingRow[]; hasMore?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load older events.");
      }
      const next = data.events ?? [];
      setEvents((prev) => [...prev, ...next]);
      setHasMore(Boolean(data.hasMore));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [events.length]);

  return (
    <>
      {showFilter && list.length > 0 && (
        <p className={styles.filterHint}>
          Showing <strong style={{ color: "#ccc" }}>{filterLabel(showFilter)}</strong> only · {list.length} event
          {list.length === 1 ? "" : "s"}
        </p>
      )}

      {events.length > 0 && list.length === 0 && showFilter && (
        <p className={styles.emptyText}>
          No completed {filterLabel(showFilter)} events in the loaded history yet. Try &quot;All&quot; or load older events to pull in more shows.
        </p>
      )}

      {list.length > 0 && (
        <ul className={styles.cardList}>
          {list.map((event) => {
            const title = getEventResultsCardTitle(event);
            const meta = formatEventResultsListMetaLine(event);
            const logoSrc = getEventLogoPath(event.name, event.id);
            const href = eventResultsHref(event);
            return (
              <li key={event.id}>
                <Link href={href} className={styles.cardLink}>
                  <div className={styles.cardLogoWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoSrc} alt="" className={styles.cardLogo} width={56} height={48} />
                  </div>
                  <div className={styles.cardText}>
                    <h2 className={styles.cardTitle}>{title}</h2>
                    {meta ? <p className={styles.cardMeta}>{meta}</p> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className={styles.loadOlderWrap}>
          <button type="button" className={styles.loadOlderButton} onClick={loadOlder} disabled={loading}>
            {loading ? "Loading…" : "Load older events"}
          </button>
        </div>
      )}

      {error ? <p className={styles.errorText}>{error}</p> : null}
    </>
  );
}

function filterLabel(f: EventShowFilter): string {
  if (f === "raw") return "Raw";
  if (f === "smackdown") return "SmackDown";
  return "PLEs";
}
