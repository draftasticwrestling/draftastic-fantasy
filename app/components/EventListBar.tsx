"use client";

import Link from "next/link";
import { classifyEventType } from "@/lib/scoring/parsers/eventClassifier.js";
import { getEventLogoUrl } from "@/lib/howItWorksImages";
import type { RecentEvent } from "@/lib/eventsRecent";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";

function formatEventDate(dateStr: string | null): string {
  if (!dateStr || !dateStr.trim()) return "—";
  const d = dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return dateStr;
  const [y, m, day] = d.split("-");
  const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
  return `${month} ${day}, ${y}`;
}

type Props = { events: RecentEvent[] };

export default function EventListBar({ events }: Props) {
  if (!events.length) return null;

  return (
    <div className="event-list-bar" role="navigation" aria-label="Recent events">
      <div className="event-list-bar-inner">
        {events.map((event) => {
          const eventType = classifyEventType(event.name ?? "", event.id);
          const logoUrl = getEventLogoUrl(eventType);
          const href = eventResultsHref(event);
          const dateDisplay = formatEventDate(event.date);
          const locationDisplay = event.location?.trim() || "—";
          return (
            <Link
              key={event.id}
              href={href}
              className="event-list-bar-item"
              title={`${event.name ?? event.id} — ${dateDisplay} — ${locationDisplay}`}
            >
              <span className="event-list-bar-logo">
                {logoUrl ? (
                  <img src={logoUrl} alt="" width={32} height={32} />
                ) : (
                  <span className="event-list-bar-logo-placeholder">◆</span>
                )}
              </span>
              <span className="event-list-bar-date">{dateDisplay}</span>
              <span className="event-list-bar-location">{locationDisplay}</span>
            </Link>
          );
        })}
      </div>
      <Link href="/event-results" className="event-list-bar-more">
        All events →
      </Link>
    </div>
  );
}
