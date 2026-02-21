import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const metadata = {
  title: "Scored Events — Draftastic Fantasy",
  description: "Review fantasy scoring for completed events from Pro Wrestling Boxscore.",
};

export default async function ScoredEventsPage() {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, date")
    .eq("status", "completed")
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
        When a new event is added and marked completed on{" "}
        <a href="https://prowrestlingboxscore.com" target="_blank" rel="noopener noreferrer" style={{ color: "#1a73e8" }}>
          prowrestlingboxscore.com
        </a>
        , it appears here. Click an event to review fantasy scoring and confirm points per wrestler per match.
      </p>

      {error && (
        <p style={{ color: "#c00", marginBottom: 16 }}>
          Error loading events: {error.message}
        </p>
      )}

      {events && events.length === 0 && !error && (
        <p style={{ color: "#666" }}>
          No completed events yet. Add and complete events in Pro Wrestling Boxscore first.
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
                href={`/results/${encodeURIComponent(event.id)}`}
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
