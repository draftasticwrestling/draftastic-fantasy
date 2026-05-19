import Link from "next/link";
import { siteAdminSearchEvents } from "@/lib/internalAdmin/siteAdminEvents";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import styles from "../internal-admin.module.css";

export const metadata = {
  title: "Events JSON inspector — Site admin",
};

export default async function InternalAdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; date?: string; id?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const date = sp.date ?? "";
  const id = sp.id ?? "";
  const admin = getServiceRoleClient();

  if (!admin) {
    return (
      <div>
        <h1 className={styles.pageTitle}>Events</h1>
        <p style={{ color: "var(--color-text-muted)", maxWidth: 520 }}>
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to inspect events and match JSON.
        </p>
      </div>
    );
  }

  const { rows, error } = await siteAdminSearchEvents(admin, { q, date, id, limit: 45 });

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 className={styles.pageTitle}>Events JSON inspector</h1>
      <p
        style={{
          marginBottom: 20,
          maxWidth: 640,
          padding: "12px 14px",
          borderRadius: 8,
          background: "var(--color-blue-bg)",
          border: "1px solid var(--color-border)",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <strong>Editing matches or promos?</strong> Use the{" "}
        <Link href="/internal-admin/boxscore/events" className="app-link">
          Events editor
        </Link>{" "}
        (Site admin → <strong>Events</strong> in the top bar). This page is read-only for raw JSON debugging.
      </p>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 20, maxWidth: 620 }}>
        Search by <strong>event id</strong>, <strong>show date</strong> (YYYY-MM-DD), or <strong>name</strong>. Open a row
        for full fields and raw <code>matches</code> JSON.
      </p>

      <form
        method="get"
        action="/internal-admin/events"
        style={{ display: "grid", gap: 12, marginBottom: 24, maxWidth: 520 }}
      >
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
          <Link href="/internal-admin/events" className="app-link" style={{ fontSize: 14 }}>
            Reset
          </Link>
        </div>
      </form>

      {error ? (
        <p role="alert" style={{ color: "var(--color-red)", background: "var(--color-red-bg)", padding: 12, borderRadius: 6 }}>
          {error}
        </p>
      ) : null}

      {rows.length === 0 && !error ? (
        <p style={{ color: "var(--color-text-muted)" }}>No events match. Try another search or leave fields empty for recent events.</p>
      ) : null}

      {rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Name</th>
                <th style={{ padding: "10px 8px" }}>Date</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
                <th style={{ padding: "10px 8px" }}>Id</th>
                <th style={{ padding: "10px 8px" }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "10px 8px" }}>
                    <Link
                      href={`/internal-admin/events/${encodeURIComponent(e.id)}`}
                      className="app-link"
                      style={{ fontWeight: 600 }}
                    >
                      {e.name ?? "—"}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{e.date ?? "—"}</td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{e.status ?? "—"}</td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12, color: "var(--color-text-muted)" }}>
                    {e.id}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <Link
                      href={`/internal-admin/boxscore/events/${encodeURIComponent(e.id)}/edit`}
                      className="app-link"
                      style={{ fontWeight: 600 }}
                    >
                      Edit event
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p style={{ marginTop: 24, fontSize: 13, color: "var(--color-text-muted)" }}>
        Public results:{" "}
        {rows[0] ? (
          <Link href={eventResultsHref(rows[0])} className="app-link" target="_blank" rel="noopener noreferrer">
            Open first row on site
          </Link>
        ) : (
          <span>—</span>
        )}
      </p>
    </div>
  );
}
