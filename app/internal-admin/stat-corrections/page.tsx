import Link from "next/link";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import styles from "../internal-admin.module.css";

export const metadata = {
  title: "Stat corrections — Site admin",
};

type Row = {
  id: string;
  league_id: string | null;
  event_id: string;
  title: string;
  visible_at: string;
  created_at: string;
};

export default async function InternalAdminStatCorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const admin = getServiceRoleClient();

  let rows: Row[] = [];
  let loadError: string | null = null;

  if (admin) {
    const { data, error } = await admin
      .from("event_score_corrections")
      .select("id, league_id, event_id, title, visible_at, created_at")
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) {
      loadError = error.message;
    } else {
      rows = (data ?? []) as Row[];
    }
  }

  const leagueNames = new Map<string, string>();
  if (admin && rows.some((r) => r.league_id)) {
    const ids = [...new Set(rows.map((r) => r.league_id).filter(Boolean))] as string[];
    const { data: leagues } = await admin.from("leagues").select("id, name, slug").in("id", ids);
    for (const L of leagues ?? []) {
      const l = L as { id: string; name: string; slug: string };
      leagueNames.set(l.id, `${l.name} (${l.slug})`);
    }
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>
          Stat corrections
        </h1>
        <Link
          href="/internal-admin/stat-corrections/new"
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
          New correction
        </Link>
      </div>
      <p style={{ color: "var(--color-text-muted)", marginTop: 12, marginBottom: 24, maxWidth: 620 }}>
        All published and scheduled rows (service role). League members only see entries that are visible and either global
        or for their league.
      </p>

      {created ? (
        <p style={{ color: "var(--color-success)", fontWeight: 600, marginBottom: 16 }}>Correction created.</p>
      ) : null}

      {!admin ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to load corrections here.
        </p>
      ) : null}

      {loadError ? (
        <p role="alert" style={{ color: "var(--color-red)", background: "var(--color-red-bg)", padding: 12, borderRadius: 6 }}>
          {loadError}{" "}
          <span style={{ display: "block", marginTop: 8, fontSize: 13 }}>
            If the table is missing, run <code>supabase/event_score_corrections_and_admin_audit.sql</code> in Supabase.
          </span>
        </p>
      ) : null}

      {admin && !loadError && rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No corrections yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Title</th>
                <th style={{ padding: "10px 8px" }}>Scope</th>
                <th style={{ padding: "10px 8px" }}>Event id</th>
                <th style={{ padding: "10px 8px" }}>Visible</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{r.title}</td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>
                    {r.league_id ? (leagueNames.get(r.league_id) ?? r.league_id) : "All leagues"}
                  </td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>{r.event_id}</td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                    {r.visible_at?.slice(0, 16)?.replace("T", " ") ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
