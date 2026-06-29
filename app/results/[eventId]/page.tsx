import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";

// Always compute fresh so event scoring reflects the latest boxscore data.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { data: event } = await supabase
    .from("events")
    .select("name, date")
    .eq("id", eventId)
    .single();
  const title = event?.name
    ? `${event.name} — Results`
    : "Event results — Draftastic Fantasy";
  return { title };
}

function formatEventType(type: string): string {
  const labels: Record<string, string> = {
    raw: "RAW",
    smackdown: "SmackDown",
    "wrestlemania-night-1": "WrestleMania Night 1",
    "wrestlemania-night-2": "WrestleMania Night 2",
    "summerslam-night-1": "SummerSlam Night 1",
    "summerslam-night-2": "SummerSlam Night 2",
    "survivor-series": "Survivor Series",
    "royal-rumble": "Royal Rumble",
    "elimination-chamber": "Elimination Chamber",
    "crown-jewel": "Crown Jewel",
    "night-of-champions": "Night of Champions",
    "money-in-the-bank": "Money in the Bank",
    "saturday-nights-main-event": "Saturday Night's Main Event",
    backlash: "Backlash",
    evolution: "Evolution",
    "clash-in-paris": "Clash at the Castle",
    wrestlepalooza: "Wrestlepalooza",
  };
  return labels[type] || type;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", {
      month: "long",
    });
    return `${month} ${d}, ${y}`;
  }
  return dateStr;
}

/** Turn slug into display name when we don't have it in the wrestlers table */
function formatSlug(slug: string): string {
  if (!slug) return slug;
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Replace slugs in a string with display names; longest slugs first to avoid partial matches */
function replaceSlugsInString(
  str: string | string[] | null | undefined,
  slugToName: Map<string, string>
): string {
  if (str == null) return "";
  const out =
    typeof str === "string" ? str : Array.isArray(str) ? str.join(", ") : String(str);
  if (typeof out !== "string") return "";
  let result = out;
  const sortedSlugs = [...slugToName.keys()].sort(
    (a, b) => b.length - a.length
  );
  for (const slug of sortedSlugs) {
    const name = slugToName.get(slug)!;
    const regex = new RegExp(`\\b${escapeRegex(slug)}\\b`, "gi");
    result = result.replace(regex, name);
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

import type { ScoredEvent } from "@/lib/scoring/types";

export default async function EventResultsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const { data: event, error } = await supabase
    .from("events")
    .select("id, name, date, location, matches")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    notFound();
  }

  const { scoreEvent } = await import("@/lib/scoring/scoreEvent.js");
  const { normalizeWrestlerName } = await import("@/lib/scoring/parsers/participantParser.js");

  const { data: wrestlers } = await supabase
    .from("wrestlers")
    .select("id, name");
  const slugToName = new Map<string, string>();
  const slugToCanonical = new Map<string, string>();
  for (const w of wrestlers ?? []) {
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

  const scored = scoreEvent(event) as ScoredEvent;

  const displayName = (slug: string) =>
    slugToName.get(slug) ?? formatSlug(slug);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href="/score">← Scored Events</Link>
        {" · "}
        <Link href="/">Home</Link>
      </p>

      <header
        style={{
          borderBottom: "2px solid #C6A04F",
          paddingBottom: 16,
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: "0 0 4px 0", fontSize: 28 }}>
          {scored.eventName}
        </h1>
        <p style={{ margin: 0, color: "#666", fontSize: 15 }}>
          {formatDate(scored.date ?? null)}
          {scored.eventType && scored.eventType !== "unknown" && (
            <> · {formatEventType(scored.eventType)}</>
          )}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 14 }}>
          <a
            href={`https://prowrestlingboxscore.com/event/${encodeURIComponent(eventId)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#1a73e8", textDecoration: "none" }}
          >
            View Full Event Results on Pro Wrestling Boxscore
          </a>
        </p>
      </header>

            {scored.matches.length === 0 ? (
        <p>No matches in this event.</p>
      ) : (
        <section style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {scored.matches.map((match) => (
            <article
              key={match.order}
              style={{
                background: "#f8f8f8",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  background: (match as { isPromo?: boolean }).isPromo ? "#e8e8e8" : "#eee",
                  borderBottom: "1px solid #e0e0e0",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Match {match.order}
                {(match as { isPromo?: boolean }).isPromo && (
                  <span style={{ marginLeft: 8, color: "#888", fontWeight: "normal" }}>
                    — Promo (no points awarded)
                  </span>
                )}
                {match.title && match.title !== "None" && match.title !== "" && !(match as { isPromo?: boolean }).isPromo && (
                  <span style={{ marginLeft: 8, color: "#555" }}>
                    — {String(match.title)}
                  </span>
                )}
              </div>
              <div style={{ padding: 16 }}>
                <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>
                  {replaceSlugsInString(match.participants, slugToName) || match.participants}
                </p>
                {match.result && (
                  <p style={{ margin: "0 0 12px 0", color: "#444", fontSize: 14 }}>
                    {replaceSlugsInString(match.result, slugToName) || match.result}
                    {match.method && (
                      <span style={{ color: "#888" }}> · {match.method}</span>
                    )}
                  </p>
                )}
                {match.titleOutcome && match.titleOutcome !== "None" && (
                  <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#666" }}>
                    {match.titleOutcome}
                  </p>
                )}

                {(match as { isPromo?: boolean }).isPromo ? (
                  <p style={{ margin: "12px 0 0 0", fontSize: 13, color: "#888" }}>
                    No fantasy points are awarded for promo segments.
                  </p>
                ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid #ccc" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "8px 12px 8px 0",
                          fontWeight: 600,
                        }}
                      >
                        Wrestler
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 0",
                          fontWeight: 600,
                        }}
                      >
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(match.wrestlerPoints ?? []).map((wp) => {
                      return (
                        <tr key={wp.wrestler} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "10px 12px 10px 0", verticalAlign: "top" }}>
                            <strong>{displayName(wp.wrestler)}</strong>
                            {wp.breakdown && wp.breakdown.length > 0 && (
                              <ul
                                style={{
                                  margin: "4px 0 0 0",
                                  paddingLeft: 18,
                                  color: "#555",
                                  fontSize: 12,
                                  fontWeight: "normal",
                                }}
                              >
                                {wp.breakdown.map((line, i) => (
                                  <li key={i}>{line}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "10px 0",
                              textAlign: "right",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              verticalAlign: "top",
                            }}
                          >
                            <div>{wp.total} pts</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
