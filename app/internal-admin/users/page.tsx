import Link from "next/link";
import { siteAdminListUsers } from "@/lib/internalAdmin/siteAdminUsers";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import styles from "../internal-admin.module.css";

export const metadata = {
  title: "Users — Site admin",
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default async function InternalAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageParam } = await searchParams;
  const page = parsePositiveInt(pageParam, 1);
  const admin = getServiceRoleClient();

  if (!admin) {
    return (
      <div>
        <h1 className={styles.pageTitle}>Users</h1>
        <p style={{ color: "var(--color-text-muted)", maxWidth: 520 }}>
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> in the server environment to list accounts (Auth Admin API requires
          the service role after the site-admin gate).
        </p>
      </div>
    );
  }

  const perPage = 50;
  const { rows, total, error, searchHint } = await siteAdminListUsers(admin, { page, perPage, q });

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const qs = (p: number) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 className={styles.pageTitle}>Users</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 20, maxWidth: 560 }}>
        Registered accounts (Supabase Auth). Use search to match email, phone, user id, display name, or OAuth name
        metadata.
      </p>

      <form method="get" action="/internal-admin/users" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <label style={{ flex: "1 1 220px", minWidth: 180 }}>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Email, name, or user id…"
            className="admin-article-input"
            style={{ width: "100%" }}
            aria-label="Search users"
          />
        </label>
        <button type="submit" className="admin-article-submit">
          Search
        </button>
        {q.trim() ? (
          <Link href="/internal-admin/users" className="app-link" style={{ alignSelf: "center", fontSize: 14 }}>
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

      {searchHint ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginBottom: 16, maxWidth: 560 }}>{searchHint}</p>
      ) : null}

      {!error && rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          {q.trim() ? "No accounts match that search." : "No accounts returned."}
        </p>
      ) : null}

      {!error && rows.length > 0 ? (
        <>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginBottom: 12 }}>
            {q.trim()
              ? `${total} match${total === 1 ? "" : "es"}`
              : `${total} account${total === 1 ? "" : "s"} total`}
            {totalPages > 1 ? ` · page ${safePage} of ${totalPages}` : ""}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "10px 8px" }}>Display name</th>
                  <th style={{ padding: "10px 8px" }}>Email</th>
                  <th style={{ padding: "10px 8px" }}>Leagues</th>
                  <th style={{ padding: "10px 8px" }}>Draft prefs</th>
                  <th style={{ padding: "10px 8px" }}>Marketing opt-in</th>
                  <th style={{ padding: "10px 8px" }}>User id</th>
                  <th style={{ padding: "10px 8px" }}>Site admin</th>
                  <th style={{ padding: "10px 8px" }}>Created</th>
                  <th style={{ padding: "10px 8px" }}>Last sign-in</th>
                  <th style={{ padding: "10px 8px" }}>Suspended</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "10px 8px" }}>
                      <Link href={`/internal-admin/users/${encodeURIComponent(row.id)}`} className="app-link">
                        {row.display_name ?? "—"}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <Link href={`/internal-admin/users/${encodeURIComponent(row.id)}`} className="app-link">
                        {row.email ?? "—"}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 8px" }}>{row.league_count}</td>
                    <td style={{ padding: "10px 8px" }}>{row.draft_pref_count > 0 ? `Yes (${row.draft_pref_count})` : "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{row.marketing_opt_in ? "Yes" : "No"}</td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "var(--color-text-muted)",
                        fontFamily: "monospace",
                        fontSize: 12,
                      }}
                      title={row.id}
                    >
                      {row.id.slice(0, 8)}…
                    </td>
                    <td style={{ padding: "10px 8px" }}>{row.is_site_admin ? "Yes" : "—"}</td>
                    <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>
                      {row.created_at ? row.created_at.slice(0, 10) : "—"}
                    </td>
                    <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>
                      {row.last_sign_in_at ? row.last_sign_in_at.slice(0, 10) : "—"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {row.is_suspended
                        ? row.suspended_until
                          ? `Yes (until ${row.suspended_until.slice(0, 10)})`
                          : "Permanent"
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <nav style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }} aria-label="Pagination">
              {safePage > 1 ? (
                <Link href={`/internal-admin/users${qs(safePage - 1)}`} className="app-link">
                  ← Previous
                </Link>
              ) : (
                <span style={{ color: "var(--color-text-muted)" }}>← Previous</span>
              )}
              <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
                Page {safePage} of {totalPages}
              </span>
              {safePage < totalPages ? (
                <Link href={`/internal-admin/users${qs(safePage + 1)}`} className="app-link">
                  Next →
                </Link>
              ) : (
                <span style={{ color: "var(--color-text-muted)" }}>Next →</span>
              )}
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
