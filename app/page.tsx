import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  let events: { id: string; name: string | null; date: string | null; location: string | null }[] | null = null;
  let error: { message: string } | null = null;
  try {
    const supabase = await createClient();
    const result = await supabase
      .from("events")
      .select("id, name, date, location")
      .eq("status", "completed")
      .order("date", { ascending: false })
      .limit(10);
    events = result.data ?? null;
    error = result.error ? { message: result.error.message } : null;
  } catch (e) {
    error = e instanceof Error ? { message: e.message } : { message: "Failed to load events" };
  }

  return (
    <main className="app-page" style={{ fontSize: "1.1em", lineHeight: 1.5 }}>
      <p style={{ color: "var(--color-text-muted)" }}>Pro wrestling fantasy leagues — data from Pro Wrestling Boxscore.</p>
      <p>
        <Link href="/leagues" className="app-link"><strong>Private Leagues</strong></Link> — MVL system: create a league, invite friends, draft for the season only (no long-term contracts). Sign in to create or join.
      </p>
      <p>
        <Link href="/league" className="app-link">Legacy League</Link> — original league format with multi-year contracts, discovery picks, and team pages. Example league and scoring.
      </p>
      <p>
        <Link href="/mvl" className="app-link">MVL Example: The Road to SummerSlam</Link> — roadmap and rules for Private Leagues (May 1–Aug 2, 2026).
      </p>
      <p>
        <Link href="/wrestlers" className="app-link">Wrestlers</Link> — draft-eligible wrestlers and roster rules (min 4M / 4F).
      </p>
      <p>
        <Link href="/score" className="app-link">Scored Events</Link> — review fantasy scoring for completed events from Pro Wrestling Boxscore.
      </p>
      <p>
        <Link href="/how-it-works" className="app-link">How it works</Link> — scoring rules, event types, titles, and special matches.
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16, color: "var(--color-text)" }}>Recent completed events</h2>
        {error && (
          <p style={{ color: "var(--color-red)", fontSize: "1em" }}>
            Error loading events: {error.message}. Check .env (NEXT_PUBLIC_SUPABASE_*).
          </p>
        )}
        {events && events.length === 0 && !error && (
          <p style={{ color: "var(--color-text-muted)" }}>No events in the database yet.</p>
        )}
        {events && events.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, fontSize: "1.1em" }}>
            {events.map((event) => (
              <li
                key={event.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <Link href={`/results/${event.id}`} className="app-link">
                  <strong>{event.name}</strong> — {event.date}
                  {event.location && ` · ${event.location}`}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="https://www.prowrestlingboxscore.com" target="_blank" rel="noopener" className="app-link">
          Pro Wrestling Boxscore →
        </Link>
      </p>
    </main>
  );
}
