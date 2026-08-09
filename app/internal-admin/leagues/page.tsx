import Link from "next/link";
import { siteAdminSearchLeagues, type SiteAdminLeagueSummary } from "@/lib/internalAdmin/siteAdminLeagues";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import {
  LEAGUE_ADMIN_VIEWS,
  PRIVATE_LEAGUE_ABANDON_ARCHIVE_AFTER_DAYS,
  PRIVATE_LEAGUE_INACTIVE_AFTER_DAYS,
  classifyLeagueAdminView,
  comparePrivateActiveLeagues,
  isLeagueFullyStarted,
  isPublicVisibility,
  parseLeagueAdminView,
  recentlyCompletedArchiveHint,
  type LeagueAdminView,
} from "@/lib/leagueAdminLifecycle";
import { getMinimumTeamsForLeagueType } from "@/lib/leagueStructure";
import styles from "../internal-admin.module.css";

function draftTypeLabel(value: string | null | undefined): string {
  const t = String(value ?? "").trim().toLowerCase();
  if (!t) return "Autopick (default)";
  if (t === "offline") return "Offline";
  if (t === "autopick") return "Autopick";
  if (t === "snake" || t === "linear") return "Autopick (legacy)";
  return t;
}

function LeagueTable({
  rows,
  view,
}: {
  rows: SiteAdminLeagueSummary[];
  view: LeagueAdminView;
}) {
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
            <th style={{ padding: "10px 8px" }}>
              {view === "inactive" ? "Inactive" : view === "archived" ? "Archived" : "Status"}
            </th>
            <th style={{ padding: "10px 8px" }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const minOwners = getMinimumTeamsForLeagueType(row.league_type);
            const started = isLeagueFullyStarted(row);
            return (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "10px 8px" }}>
                  <Link
                    href={`/internal-admin/leagues/${encodeURIComponent(row.slug)}`}
                    className="app-link"
                    style={{ fontWeight: 600 }}
                  >
                    {row.name}
                  </Link>
                  {view === "active" && !isPublicVisibility(row.visibility_type) && started ? (
                    <span
                      style={{
                        display: "inline-block",
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--color-blue)",
                        textTransform: "uppercase",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Live
                    </span>
                  ) : null}
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
                  <span style={{ display: "block", fontSize: 11, opacity: 0.8 }}>min {minOwners}</span>
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
                  {view === "archived"
                    ? `Yes${row.archived_at ? ` (${row.archived_at.slice(0, 10)})` : ""}`
                    : view === "inactive"
                      ? `Yes${row.inactivated_at ? ` (${row.inactivated_at.slice(0, 10)})` : ""}`
                      : view === "recently-completed"
                        ? "Season ended"
                        : started
                          ? "Running"
                          : "Forming"}
                </td>
                <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{row.created_at.slice(0, 10)}</td>
              </tr>
            );
          })}
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
  const { q = "", view: viewRaw } = await searchParams;
  const view = parseLeagueAdminView(viewRaw);
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
  const filteredRows = rows.filter((r) => classifyLeagueAdminView(r) === view);
  const publicRows = filteredRows.filter((r) => isPublicVisibility(r.visibility_type));
  const privateRows = filteredRows
    .filter((r) => !isPublicVisibility(r.visibility_type))
    .slice()
    .sort(view === "active" ? comparePrivateActiveLeagues : (a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 className={styles.pageTitle}>Leagues</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 20, maxWidth: 640, lineHeight: 1.55 }}>
        Search by slug or name. Results are grouped into public and private leagues.{" "}
        <strong>Active</strong> private leagues that already have the format minimum of owners and a completed draft sort
        to the top. Underfilled private leagues become <strong>Inactive</strong> after{" "}
        {PRIVATE_LEAGUE_INACTIVE_AFTER_DAYS} days and auto-archive after {PRIVATE_LEAGUE_ABANDON_ARCHIVE_AFTER_DAYS} days.
        Recently completed seasons {recentlyCompletedArchiveHint().toLowerCase()}
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24, fontSize: 14 }}>
        {LEAGUE_ADMIN_VIEWS.map((item) => (
          <Link
            key={item.id}
            href={`/internal-admin/leagues?${new URLSearchParams({ ...(q ? { q } : {}), view: item.id }).toString()}`}
            className="app-link"
            style={{ fontWeight: view === item.id ? 700 : 400 }}
          >
            {item.label}
          </Link>
        ))}
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
        <p style={{ color: "var(--color-text-muted)" }}>{q ? "No leagues match that search." : "No leagues in this view."}</p>
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
              <LeagueTable rows={publicRows} view={view} />
            )}
          </section>
          <section>
            <h2 className={styles.pageTitle} style={{ fontSize: "1.05rem", margin: "0 0 10px" }}>
              Private leagues
              <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: 14, marginLeft: 8 }}>
                ({privateRows.length})
              </span>
            </h2>
            {view === "active" ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: "0 0 10px", maxWidth: 620 }}>
                Fully started leagues (minimum owners + completed draft) are listed first.
              </p>
            ) : null}
            {privateRows.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", margin: 0 }}>None in this result set.</p>
            ) : (
              <LeagueTable rows={privateRows} view={view} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
