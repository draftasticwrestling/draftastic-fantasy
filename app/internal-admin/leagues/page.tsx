import Link from "next/link";
import { siteAdminSearchLeagues } from "@/lib/internalAdmin/siteAdminLeagues";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import styles from "../internal-admin.module.css";

export const metadata = {
  title: "Leagues — Site admin",
};

export default async function InternalAdminLeaguesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const admin = getServiceRoleClient();
  if (!admin) {
    return (
      <div>
        <h1 className={styles.pageTitle}>Leagues</h1>
        <p style={{ color: "var(--color-text-muted)", maxWidth: 520 }}>
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> in the server environment to search leagues (read-only tools use the
          service role after site-admin gate).
        </p>
      </div>
    );
  }

  const { rows, error } = await siteAdminSearchLeagues(admin, q);

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 className={styles.pageTitle}>Leagues</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 20, maxWidth: 560 }}>
        Read-only directory: search by slug or name. Open a league for members and active roster counts.
      </p>

      <form method="get" action="/internal-admin/leagues" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <label style={{ flex: "1 1 220px", minWidth: 180 }}>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Slug or league name…"
            className="admin-article-input"
            style={{ width: "100%" }}
            aria-label="Search leagues by slug or name"
          />
        </label>
        <button type="submit" className="admin-article-submit">
          Search
        </button>
        {q ? (
          <Link href="/internal-admin/leagues" className="app-link" style={{ alignSelf: "center", fontSize: 14 }}>
            Clear
          </Link>
        ) : null}
      </form>

      {error ? (
        <p
          role="alert"
          style={{
            color: "var(--color-red)",
            background: "var(--color-red-bg)",
            padding: "12px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
          }}
        >
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>{q ? "No leagues match that search." : "No leagues found."}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>League</th>
                <th style={{ padding: "10px 8px" }}>Slug</th>
                <th style={{ padding: "10px 8px" }}>Commissioner</th>
                <th style={{ padding: "10px 8px" }}>Season</th>
                <th style={{ padding: "10px 8px" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "10px 8px" }}>
                    <Link href={`/internal-admin/leagues/${encodeURIComponent(row.slug)}`} className="app-link" style={{ fontWeight: 600 }}>
                      {row.name}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>
                    {row.slug}
                  </td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>
                    {row.commissioner_display_name ?? "—"}
                    <span style={{ display: "block", fontSize: 12, opacity: 0.85 }} title="User id">
                      {row.commissioner_id.slice(0, 8)}…
                    </span>
                  </td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>
                    {row.start_date || "—"} → {row.end_date || "—"}
                  </td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{row.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
