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
    <main style={{ fontFamily: "system-ui, sans-serif", fontSize: "18px", lineHeight: 1.5 }}>
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: "1.1em" }}>Pro wrestling fantasy leagues — data from Pro Wrestling Boxscore.</p>
        <p style={{ fontSize: "1.1em" }}>
          <Link href="/leagues"><strong>Private Leagues</strong></Link> — MVL system: create a league, invite friends, draft for the season only (no long-term contracts). Sign in to create or join.
        </p>
        <p style={{ fontSize: "1.1em" }}>
          <Link href="/league">Legacy League</Link> — original league format with multi-year contracts, discovery picks, and team pages. Example league and scoring.
        </p>
        <p style={{ fontSize: "1.1em" }}>
          <Link href="/mvl">MVL Example: The Road to SummerSlam</Link> — roadmap and rules for Private Leagues (May 1–Aug 2, 2026).
        </p>
        <p style={{ fontSize: "1.1em" }}>
          <Link href="/wrestlers">Wrestlers</Link> — draft-eligible wrestlers and roster rules (min 4M / 4F).
        </p>
        <p style={{ fontSize: "1.1em" }}>
          <Link href="/score">Scored Events</Link> — review fantasy scoring for completed events from Pro Wrestling Boxscore.
        </p>
        <p style={{ fontSize: "1.1em" }}>
          <Link href="/how-it-works">How it works</Link> — scoring rules, event types, titles, and special matches.
        </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 16 }}>Recent completed events</h2>
        {error && (
          <p style={{ color: "red", fontSize: "1em" }}>
            Error loading events: {error.message}. Check .env (NEXT_PUBLIC_SUPABASE_*).
          </p>
        )}
        {events && events.length === 0 && !error && (
          <p style={{ fontSize: "1.1em" }}>No events in the database yet.</p>
        )}
        {events && events.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, fontSize: "1.1em" }}>
            {events.map((event) => (
              <li
                key={event.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <Link
                  href={`/results/${event.id}`}
                  style={{ color: "#1a73e8", textDecoration: "none" }}
                >
                  <strong>{event.name}</strong> — {event.date}
                  {event.location && ` · ${event.location}`}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

        <p style={{ marginTop: 24, fontSize: "1.1em" }}>
          <Link href="https://www.prowrestlingboxscore.com" target="_blank" rel="noopener">
            Pro Wrestling Boxscore →
          </Link>
        </p>
      </div>
    </main>
  );
}
