import { supabase } from "@/lib/supabase";
import { EVENT_STATUSES_FOR_SCORING } from "@/lib/eventsScoring";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import Link from "next/link";

export const metadata = {
  title: "Scored Events — Draftastic Fantasy",
  description: "Review fantasy scoring for completed and in-progress events from Pro Wrestling Boxscore (live shows include finished matches only).",
};

export default async function ScoredEventsPage() {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, date")
    .in("status", [...EVENT_STATUSES_FOR_SCORING])
    .order("date", { ascending: false })
    .limit(60);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>← Home</Link>
      </p>

      <h1 style={{ fontSize: "1.75rem", marginBottom: 8 }}>Scored Events</h1>
      <p style={{ color: "#555", marginBottom: 24, fontSize: 15 }}>
        Lists events from{" "}
        <a href="https://prowrestlingboxscore.com" target="_blank" rel="noopener noreferrer" style={{ color: "#1a73e8" }}>
          Pro Wrestling Boxscore
        </a>{" "}
        with status <strong>live</strong> or <strong>completed</strong>. Fantasy points include only matches marked{" "}
        <strong>completed</strong> on the card (so totals grow as each match finishes during a live show). Open an event
        for per-wrestler, per-match scoring.
      </p>

      {error && (
        <p style={{ color: "#c00", marginBottom: 16 }}>
          Error loading events: {error.message}
        </p>
      )}

      {events && events.length === 0 && !error && (
        <p style={{ color: "#666" }}>
          No live or completed events yet. Add events in Pro Wrestling Boxscore first.
        </p>
      )}

      {events && events.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {events.map((event) => (
            <li
              key={event.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <Link
                href={eventResultsHref(event)}
                style={{ color: "#1a73e8", textDecoration: "none", fontWeight: 500 }}
              >
                {event.name}
              </Link>
              <span style={{ color: "#666", marginLeft: 10 }}>{event.date}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
