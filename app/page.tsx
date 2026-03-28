import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRecentEvents } from "@/lib/eventsRecent";

export const metadata = {
  title: "Draftastic Pro Wrestling — Results & News",
  description: "Event results, fantasy scoring, and commentary — Draftastic Pro Wrestling.",
};

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
    return `${month} ${Number(d)}, ${y}`;
  }
  return dateStr;
}

function matchLine(m: unknown, i: number): string {
  if (!m || typeof m !== "object") return `Match ${i + 1}`;
  const o = m as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : "";
  const mt = typeof o.matchType === "string" ? o.matchType : "";
  const st = typeof o.stipulation === "string" ? o.stipulation : "";
  const parts = [title, mt, st].filter(Boolean);
  return parts.length ? parts.join(" · ") : `Match ${i + 1}`;
}

export default async function HubHomePage() {
  const supabase = await createClient();
  const recent = await getRecentEvents(1);
  const featured = recent[0];
  let matchLines: string[] = [];
  if (featured) {
    const { data } = await supabase
      .from("events")
      .select("matches")
      .eq("id", featured.id)
      .maybeSingle();
    const matches = Array.isArray(data?.matches) ? data.matches : [];
    matchLines = matches.slice(0, 5).map((m, i) => matchLine(m, i));
  }

  const placeholderHeadlines = [
    { href: "/news", label: "Articles coming soon — fantasy takes on the week in wrestling" },
    { href: "/fantasy", label: "Play Draftastic Fantasy — create a league with friends" },
    { href: "/event-results", label: "Browse all completed events and fantasy scoring" },
  ];

  return (
    <>
      <section className="hub-hero">
        <div className="hub-hero-inner">
          <img src="/draftastic_belt_logo.png" alt="" className="hub-hero-logo" />
          <div className="hub-hero-copy">
            <h1>Draftastic Fantasy Pro Wrestling</h1>
            <p className="hub-hero-tagline">Putting the sport back in sports entertainment.</p>
            <div className="hub-hero-actions">
              <Link href="/coming-soon" className="hub-hero-btn hub-hero-btn-primary">
                Join the list — get notified at launch
              </Link>
              <Link href="/fantasy#how-it-works" className="hub-hero-btn hub-hero-btn-outline">
                See how it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="hub-shell">
        <aside className="hub-col hub-col-side" aria-label="Quick links">
          <h2 className="hub-col-title">Quick links</h2>
          <nav className="hub-quick-nav">
            <Link href="/event-results">Events</Link>
            <Link href="/wrestlers">Wrestlers</Link>
            <span className="hub-quick-muted">Statistics (soon)</span>
            <span className="hub-quick-muted">WrestleMania (soon)</span>
            <Link href="/fantasy">Fantasy home</Link>
            <Link href="/how-it-works">Fantasy rules</Link>
            <span className="hub-quick-muted">FantasyCast (soon)</span>
          </nav>
        </aside>

        <section className="hub-col hub-col-main" aria-labelledby="hub-latest-heading">
          <h2 id="hub-latest-heading" className="hub-col-title">
            Latest event results
          </h2>
          {featured ? (
            <>
              <div className="hub-event-bar">
                <span className="hub-event-bar-text">
                  {formatEventDate(featured.date)}
                  {featured.name ? ` — ${featured.name}` : ""}
                  {featured.location ? ` — ${featured.location}` : ""}
                </span>
              </div>
              <div className="hub-event-card">
                {matchLines.length > 0 ? (
                  <ul className="hub-match-preview">
                    {matchLines.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="hub-muted">Match breakdown loads on the full results page.</p>
                )}
                <Link
                  href={`/event-results/${encodeURIComponent(featured.id)}`}
                  className="hub-event-cta"
                >
                  Full results &amp; fantasy scoring →
                </Link>
              </div>
              <p className="hub-muted hub-legal-note" style={{ marginTop: 16 }}>
                Summary, commentary, and detailed stats views will match the Pro Wrestling Boxscore style as we merge the sites.
              </p>
            </>
          ) : (
            <p className="hub-muted">No completed events yet. Check back after the next show.</p>
          )}
          <div className="hub-tab-placeholder" role="note">
            <span>Summary</span>
            <span>Commentary</span>
            <span>Statistics</span>
          </div>
        </section>

        <aside className="hub-col hub-col-side" aria-label="Headlines">
          <h2 className="hub-col-title">Top headlines</h2>
          <ul className="hub-headlines">
            {placeholderHeadlines.map((h) => (
              <li key={h.href}>
                <Link href={h.href}>{h.label}</Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
