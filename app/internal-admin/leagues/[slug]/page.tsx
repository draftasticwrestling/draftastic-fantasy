import Link from "next/link";
import { notFound } from "next/navigation";
import { siteAdminGetLeagueBySlug } from "@/lib/internalAdmin/siteAdminLeagues";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${decodeURIComponent(slug)} — League — Site admin` };
}

export default async function InternalAdminLeagueDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const admin = getServiceRoleClient();
  if (!admin) {
    return (
      <div>
        <p style={{ color: "var(--color-text-muted)" }}>
          <Link href="/internal-admin/leagues" className="app-link">
            ← Leagues
          </Link>
        </p>
        <p style={{ color: "var(--color-red)" }}>Service role key is not configured.</p>
      </div>
    );
  }

  const { detail, error } = await siteAdminGetLeagueBySlug(admin, slug);
  if (error) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Link href="/internal-admin/leagues" className="app-link">
            ← Leagues
          </Link>
        </p>
        <p
          role="alert"
          style={{
            color: "var(--color-red)",
            background: "var(--color-red-bg)",
            padding: "12px 14px",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {error}
        </p>
      </div>
    );
  }
  if (!detail) notFound();

  const { league, members } = detail;

  return (
    <div style={{ maxWidth: 960 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/leagues" className="app-link">
          ← Leagues
        </Link>
        {" · "}
        <Link href={`/leagues/${encodeURIComponent(league.slug)}`} className="app-link" target="_blank" rel="noopener noreferrer">
          Open league (member UI)
        </Link>
      </p>

      <h1 style={{ fontSize: "1.35rem", margin: "0 0 8px" }}>{league.name}</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, fontFamily: "monospace", fontSize: 14 }}>
        /{league.slug} · id {league.id}
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Details</h2>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr",
            gap: "8px 16px",
            fontSize: 14,
            margin: 0,
          }}
        >
          <dt style={{ color: "var(--color-text-muted)" }}>Commissioner</dt>
          <dd style={{ margin: 0 }}>
            {league.commissioner_display_name ?? "—"}{" "}
            <code style={{ fontSize: 12, opacity: 0.9 }}>{league.commissioner_id}</code>
          </dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Season window</dt>
          <dd style={{ margin: 0 }}>
            {league.start_date ?? "—"} → {league.end_date ?? "—"}
          </dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Season slug</dt>
          <dd style={{ margin: 0 }}>{league.season_slug ?? "—"}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Draft date</dt>
          <dd style={{ margin: 0 }}>{league.draft_date ?? "—"}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Format</dt>
          <dd style={{ margin: 0 }}>
            {league.league_type ?? "—"}
            {league.max_teams != null ? ` · max ${league.max_teams} teams` : ""}
          </dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Created</dt>
          <dd style={{ margin: 0 }}>{league.created_at}</dd>
        </dl>
      </section>

      <section>
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Members ({members.length})</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Role</th>
                <th style={{ padding: "10px 8px" }}>Team / name</th>
                <th style={{ padding: "10px 8px" }}>User id</th>
                <th style={{ padding: "10px 8px" }}>Joined</th>
                <th style={{ padding: "10px 8px" }}>Active roster</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "10px 8px" }}>{m.role}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <strong>{m.team_name || m.display_name || "—"}</strong>
                    {m.team_name && m.display_name ? (
                      <span style={{ display: "block", color: "var(--color-text-muted)", fontSize: 13 }}>{m.display_name}</span>
                    ) : null}
                  </td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>{m.user_id}</td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{m.joined_at.slice(0, 10)}</td>
                  <td style={{ padding: "10px 8px" }}>{m.active_roster_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
