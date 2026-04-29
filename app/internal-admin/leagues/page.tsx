import Link from "next/link";
import { siteAdminSearchLeagues, type SiteAdminLeagueSummary } from "@/lib/internalAdmin/siteAdminLeagues";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import styles from "../internal-admin.module.css";

function isPublicLeague(row: SiteAdminLeagueSummary) {
  return String(row.visibility_type ?? "").toLowerCase() === "public";
}

function draftTypeLabel(value: string | null | undefined): string {
  const t = String(value ?? "").trim().toLowerCase();
  if (!t) return "Autopick (default)";
  if (t === "offline") return "Offline";
  if (t === "autopick") return "Autopick";
  if (t === "snake" || t === "linear") return "Autopick (legacy)";
  return t;
}

function LeagueTable({ rows }: { rows: SiteAdminLeagueSummary[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
            <th style={{ padding: "10px 8px" }}>League</th>
            <th style={{ padding: "10px 8px" }}>Slug</th>
            <th style={{ padding: "10px 8px" }}>Owners</th>
            <th style={{ padding: "10px 8px" }}>Commissioner</th>
            <th style={{ padding: "10px 8px" }}>Season</th>
            <th style={{ padding: "10px 8px" }}>Draft review</th>
            <th style={{ padding: "10px 8px" }}>Draft type</th>
            <th style={{ padding: "10px 8px" }}>Archived</th>
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
              <td style={{ padding: "10px 8px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                {row.member_count}
                {row.max_teams != null ? (
                  <span style={{ opacity: 0.75 }}>
                    {" "}
                    / {row.max_teams}
                  </span>
                ) : null}
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
              <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>
                {row.draft_status === "ready_for_review" ? (
                  <span style={{ color: "var(--color-warning)" }}>Ready for review</span>
                ) : (
                  (row.draft_status ?? "—")
                )}
              </td>
              <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>
                {draftTypeLabel(row.draft_type)}
              </td>
              <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>
                {row.is_archived ? `Yes${row.archived_at ? ` (${row.archived_at.slice(0, 10)})` : ""}` : "—"}
              </td>
              <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{row.created_at.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const metadata = {
  title: "Leagues — Site admin",
};

export default async function InternalAdminLeaguesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { q = "", view: viewRaw = "current" } = await searchParams;
  const view: "current" | "archived" | "all" =
    viewRaw === "archived" || viewRaw === "all" ? viewRaw : "current";
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
  const filteredRows =
    view === "archived"
      ? rows.filter((r) => Boolean(r.is_archived))
      : view === "current"
        ? rows.filter((r) => !Boolean(r.is_archived))
        : rows;
  const publicRows = filteredRows.filter(isPublicLeague);
  const privateRows = filteredRows.filter((r) => !isPublicLeague(r));

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 className={styles.pageTitle}>Leagues</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 20, maxWidth: 560 }}>
        Read-only directory: search by slug or name. Results are grouped into public and private leagues. Owners counts
        include every registered member; open a league for roster detail.
      </p>

      <form method="get" action="/internal-admin/leagues" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <input type="hidden" name="view" value={view} />
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
          <Link
            href={`/internal-admin/leagues?view=${encodeURIComponent(view)}`}
            className="app-link"
            style={{ alignSelf: "center", fontSize: 14 }}
          >
            Clear
          </Link>
        ) : null}
      </form>
      <div style={{ display: "flex", gap: 14, marginBottom: 24, fontSize: 14 }}>
        <Link
          href={`/internal-admin/leagues?${new URLSearchParams({ ...(q ? { q } : {}), view: "current" }).toString()}`}
          className="app-link"
          style={{ fontWeight: view === "current" ? 700 : 400 }}
        >
          Current leagues
        </Link>
        <Link
          href={`/internal-admin/leagues?${new URLSearchParams({ ...(q ? { q } : {}), view: "archived" }).toString()}`}
          className="app-link"
          style={{ fontWeight: view === "archived" ? 700 : 400 }}
        >
          Archived leagues
        </Link>
        <Link
          href={`/internal-admin/leagues?${new URLSearchParams({ ...(q ? { q } : {}), view: "all" }).toString()}`}
          className="app-link"
          style={{ fontWeight: view === "all" ? 700 : 400 }}
        >
          All leagues
        </Link>
      </div>

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

      {filteredRows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>{q ? "No leagues match that search." : "No leagues found."}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <section>
            <h2 className={styles.pageTitle} style={{ fontSize: "1.05rem", margin: "0 0 10px" }}>
              Public leagues
              <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: 14, marginLeft: 8 }}>
                ({publicRows.length})
              </span>
            </h2>
            {publicRows.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", margin: 0 }}>None in this result set.</p>
            ) : (
              <LeagueTable rows={publicRows} />
            )}
          </section>
          <section>
            <h2 className={styles.pageTitle} style={{ fontSize: "1.05rem", margin: "0 0 10px" }}>
              Private leagues
              <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: 14, marginLeft: 8 }}>
                ({privateRows.length})
              </span>
            </h2>
            {privateRows.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", margin: 0 }}>None in this result set.</p>
            ) : (
              <LeagueTable rows={privateRows} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
