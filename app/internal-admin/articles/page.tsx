import Link from "next/link";
import { listAllArticlesForAdmin } from "@/lib/articles";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import {
  aggregateArticleEngagementForSlug,
  articleSlugFromEngagementRow,
  type RawEngagementEvent,
} from "@/lib/articleEngagementStats";

export const metadata = {
  title: "Articles — Site admin",
};

export default async function InternalAdminArticlesListPage() {
  const rows = await listAllArticlesForAdmin();
  const admin = getServiceRoleClient();

  const eventBuckets = new Map<string, RawEngagementEvent[]>();
  if (admin) {
    const { data } = await admin
      .from("engagement_events")
      .select("event_name, user_id, occurred_at, path, metadata")
      .in("event_name", ["page.news_article_view", "page.news_article_dwell"])
      .order("occurred_at", { ascending: false })
      .limit(100_000);

    for (const row of (data ?? []) as RawEngagementEvent[]) {
      const slugKey = articleSlugFromEngagementRow(row);
      if (!slugKey) continue;
      if (!eventBuckets.has(slugKey)) eventBuckets.set(slugKey, []);
      eventBuckets.get(slugKey)!.push(row);
    }
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Articles</h1>
        <Link
          href="/internal-admin/articles/new"
          style={{
            padding: "10px 18px",
            background: "var(--color-blue)",
            color: "var(--color-text-inverse)",
            textDecoration: "none",
            borderRadius: "var(--radius)",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          New article
        </Link>
      </div>
      <p style={{ color: "var(--color-text-muted)", marginTop: 8, marginBottom: 8 }}>
        Draft and publish news posts (Markdown). Public site shows only published articles with a set publish date.
      </p>
      {!admin ? (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16, fontSize: 14 }}>
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to load per-article view and dwell analytics.
        </p>
      ) : (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16, fontSize: 13 }}>
          Analytics include anonymous readers when the service role is configured (visitor key in browser storage).{" "}
          <strong>Avg dwell</strong> averages sessions that ended with a ≥3s dwell sample (tab hidden, navigate away, or
          close). <strong>24h / 7d</strong> counts views after <code>published_at</code> (published articles only).
        </p>
      )}

      {rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No articles yet. Create one to get started.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "10px 8px", minWidth: 200 }}>Article</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
                <th style={{ padding: "10px 8px" }}>Published</th>
                <th style={{ padding: "10px 8px" }}>Total views</th>
                <th style={{ padding: "10px 8px" }}>Unique visitors</th>
                <th style={{ padding: "10px 8px" }}>Signed-in viewers</th>
                <th style={{ padding: "10px 8px" }} title="Mean seconds among sessions that sent a dwell sample (≥3s)">
                  Avg dwell (s)
                </th>
                <th style={{ padding: "10px 8px" }}>Views 24h</th>
                <th style={{ padding: "10px 8px" }}>Views 7d</th>
                <th style={{ padding: "10px 8px" }}>Slug</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const stats = admin
                  ? aggregateArticleEngagementForSlug(
                      eventBuckets.get(a.slug) ?? [],
                      a.slug,
                      a.status === "published" ? a.published_at : null
                    )
                  : null;
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--color-border)", verticalAlign: "top" }}>
                    <td style={{ padding: "10px 8px" }}>
                      <Link href={`/internal-admin/articles/${a.id}/edit`} className="app-link" style={{ fontWeight: 600 }}>
                        {a.title}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{a.status}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", color: "var(--color-text-muted)" }}>
                      {a.published_at ? a.published_at.slice(0, 10) : "—"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>{stats ? stats.totalViews : "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{stats ? stats.uniqueVisitors : "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{stats ? stats.uniqueSignedInVisitors : "—"}</td>
                    <td style={{ padding: "10px 8px" }}>
                      {stats && stats.avgDwellSeconds != null
                        ? `${stats.avgDwellSeconds} (n=${stats.dwellSampleCount})`
                        : "—"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>{stats ? stats.viewsFirst24Hours : "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{stats ? stats.viewsFirstWeek : "—"}</td>
                    <td style={{ padding: "10px 8px", fontFamily: "monospace", color: "var(--color-text-muted)" }}>
                      /{a.slug}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
