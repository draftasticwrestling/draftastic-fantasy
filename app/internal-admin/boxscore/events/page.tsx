import Link from "next/link";
import styles from "../../internal-admin.module.css";
import { siteAdminSearchEvents } from "@/lib/internalAdmin/siteAdminEvents";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import { DeleteBoxscoreEventForm } from "./DeleteBoxscoreEventForm";
import { JumpToBoxscoreEventEditor } from "./JumpToBoxscoreEventEditor";

export const metadata = { title: "Events (Boxscore) — Site admin" };

export default async function BoxscoreEventsEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; date?: string; id?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const date = sp.date ?? "";
  const id = sp.id ?? "";
  const ok = sp.ok ?? "";
  const admin = getServiceRoleClient();

  const { rows, error } = admin ? await siteAdminSearchEvents(admin, { q, date, id }) : { rows: [], error: undefined };

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/boxscore" className="app-link">
          ← Boxscore admin
        </Link>
      </p>
      <h1 className={styles.pageTitle}>Events, matches &amp; promos</h1>
      <p className={styles.intro}>
        Editors for the shared PWBS <code>events</code> table. Search and manage events here, or use the read-only inspector under{" "}
        <Link href="/internal-admin/events" className="app-link">
          /internal-admin/events
        </Link>
        .
      </p>
      {ok ? (
        <p
          style={{
            marginTop: 12,
            color: "#166534",
            background: "#ecfdf3",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: "10px 12px",
            maxWidth: 760,
          }}
        >
          {ok}
        </p>
      ) : null}
      <ul style={{ listStyle: "none", padding: 0, margin: "24px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
        <li>
          <Link href="/internal-admin/boxscore/events/new" className={styles.cardLink}>
            <span className={styles.cardTitle}>Add event</span>
            <span className={styles.cardDesc}>
              Create a new event with the visual match builder and inline MatchEdit (PWBS-shaped payloads).
            </span>
          </Link>
        </li>
        <li
          className={styles.cardLink}
          style={{ display: "block", cursor: "default", textDecoration: "none", color: "inherit" }}
        >
          <span className={styles.cardTitle}>Edit an existing event</span>
          <span className={styles.cardDesc} style={{ display: "block" }}>
            Use the full editor at{" "}
            <code style={{ fontSize: 12 }}>/internal-admin/boxscore/events/[eventId]/edit</code>. Easiest path: open an event in
            the inspector and click <strong>Edit in boxscore</strong>.
          </span>
          <p style={{ margin: "12px 0 0", fontSize: 14 }}>
            <Link href="/internal-admin/events" className="app-link">
              Open Events inspector →
            </Link>
          </p>
          <JumpToBoxscoreEventEditor />
        </li>
      </ul>
      <section style={{ marginTop: 28 }}>
        <h2 className={styles.pageTitle} style={{ fontSize: "1.06rem", marginBottom: 10 }}>
          Manage existing events
        </h2>
        {!admin ? (
          <p style={{ color: "var(--color-text-muted)", maxWidth: 520 }}>
            Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to list and manage events.
          </p>
        ) : (
          <>
            <form method="get" action="/internal-admin/boxscore/events" style={{ display: "grid", gap: 12, marginBottom: 20, maxWidth: 560 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
                Event id (exact)
                <input name="id" defaultValue={id} className="admin-article-input" placeholder="e.g. raw-2026-04-01 or UUID" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
                Date (YYYY-MM-DD)
                <input name="date" type="text" defaultValue={date} className="admin-article-input" placeholder="2026-04-03" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
                Name contains
                <input name="q" defaultValue={q} className="admin-article-input" placeholder="SmackDown" />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <button type="submit" className="admin-article-submit">
                  Search
                </button>
                <Link href="/internal-admin/boxscore/events" className="app-link" style={{ fontSize: 14 }}>
                  Reset
                </Link>
              </div>
            </form>

            {error ? (
              <p role="alert" style={{ color: "var(--color-red)", background: "var(--color-red-bg)", padding: 12, borderRadius: 6 }}>
                {error}
              </p>
            ) : null}
            {!error && rows.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>No events match this search.</p>
            ) : null}
            {!error && rows.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                      <th style={{ padding: "10px 8px" }}>Event</th>
                      <th style={{ padding: "10px 8px" }}>Date</th>
                      <th style={{ padding: "10px 8px" }}>Status</th>
                      <th style={{ padding: "10px 8px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "10px 8px" }}>
                          <div style={{ fontWeight: 600 }}>{row.name ?? "—"}</div>
                          <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--color-text-muted)" }}>{row.id}</div>
                        </td>
                        <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{row.date ?? "—"}</td>
                        <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{row.status ?? "—"}</td>
                        <td style={{ padding: "10px 8px", minWidth: 360 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                            <Link href={`/internal-admin/boxscore/events/${encodeURIComponent(row.id)}/edit`} className="app-link">
                              Edit
                            </Link>
                            <Link href={`/internal-admin/events/${encodeURIComponent(row.id)}`} className="app-link">
                              Inspect
                            </Link>
                            <Link href={eventResultsHref(row)} className="app-link" target="_blank" rel="noopener noreferrer">
                              View public
                            </Link>
                            <DeleteBoxscoreEventForm eventId={row.id} eventName={row.name ?? row.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
