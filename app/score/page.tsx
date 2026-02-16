import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const metadata = {
  title: "Score an event — Draftastic Fantasy",
  description: "Run fantasy points for an event from Pro Wrestling Boxscore.",
};

export default async function ScorePage() {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, date")
    .eq("status", "completed")
    .order("date", { ascending: false })
    .limit(30);

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
        <Link href="/">← Home</Link>
      </p>

      <h1>Score an event</h1>
      <p>
        Pick a completed event below to see fantasy points per wrestler per match.
      </p>

      {error && (
        <p style={{ color: "red" }}>
          Error loading events: {error.message}
        </p>
      )}

      {events && events.length === 0 && !error && (
        <p>No events in the database. Add events in Pro Wrestling Boxscore first.</p>
      )}

      {events && events.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
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
                style={{ color: "#0066cc", textDecoration: "underline" }}
              >
                {event.name}
              </Link>
              <span style={{ color: "#666", marginLeft: 8 }}>{event.date}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
