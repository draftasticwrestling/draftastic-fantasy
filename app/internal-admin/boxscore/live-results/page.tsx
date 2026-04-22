import Link from "next/link";
import { requireSiteAdmin } from "@/lib/auth/siteAdmin";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import styles from "../../internal-admin.module.css";

export const metadata = { title: "Live results — Site admin" };

type EventRow = {
  id: string;
  name: string | null;
  date: string | null;
  status: string | null;
  isLive: boolean | null;
  matches: unknown[] | null;
};

function getLiveMatchCount(matches: unknown[] | null | undefined): number {
  if (!Array.isArray(matches)) return 0;
  let count = 0;
  for (const raw of matches) {
    const row = raw as { status?: string | null; isLive?: boolean | null } | null;
    const status = String(row?.status ?? "").toLowerCase();
    if (Boolean(row?.isLive) || status === "live" || status === "in-progress") count += 1;
  }
  return count;
}

export default async function BoxscoreLiveResultsPage() {
  await requireSiteAdmin();
  const admin = getServiceRoleClient();
  if (!admin) {
    return (
      <div>
        <p style={{ marginBottom: 16 }}>
          <Link href="/internal-admin/boxscore" className="app-link">
            ← Boxscore admin
          </Link>
        </p>
        <h1 className={styles.pageTitle}>Live results</h1>
        <p style={{ color: "var(--color-text-muted)", maxWidth: 520 }}>
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to manage in-progress event results.
        </p>
      </div>
    );
  }

  const [{ data: liveRows }, { data: recentRows }] = await Promise.all([
    admin
      .from("events")
      .select("id,name,date,status,isLive,matches")
      .or("status.eq.live,isLive.eq.true")
      .order("date", { ascending: false })
      .limit(20),
    admin
      .from("events")
      .select("id,name,date,status,isLive,matches")
      .order("date", { ascending: false })
      .limit(40),
  ]);

  const liveEvents = ((liveRows ?? []) as EventRow[]).filter(
    (row) => String(row.status ?? "").toLowerCase() === "live" || Boolean(row.isLive)
  );
  const recentEvents = (recentRows ?? []) as EventRow[];

  return (
    <div style={{ maxWidth: 980 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/boxscore" className="app-link">
          ← Boxscore admin
        </Link>
      </p>
      <h1 className={styles.pageTitle}>Live results</h1>
      <p className={styles.intro} style={{ maxWidth: 760 }}>
        Use your existing event editor workflow for live shows. This page surfaces active events fast, with one-click links into
        edit mode and event inspection.
      </p>

      <section style={{ marginTop: 20 }}>
        <h2 className={styles.pageTitle} style={{ fontSize: "1.05rem", marginBottom: 10 }}>
          Active live events
          <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: 14, marginLeft: 8 }}>
            ({liveEvents.length})
          </span>
        </h2>
        {liveEvents.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>
            No events currently marked live. Start by editing an event and setting status to <code>live</code>.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "10px 8px" }}>Event</th>
                  <th style={{ padding: "10px 8px" }}>Date</th>
                  <th style={{ padding: "10px 8px" }}>Live matches</th>
                  <th style={{ padding: "10px 8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {liveEvents.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ fontWeight: 600 }}>{row.name ?? row.id}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--color-text-muted)" }}>{row.id}</div>
                    </td>
                    <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{row.date ?? "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{getLiveMatchCount(row.matches)}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        <Link href={`/internal-admin/boxscore/events/${encodeURIComponent(row.id)}/edit`} className="app-link">
                          Open live editor
                        </Link>
                        <Link href={`/internal-admin/events/${encodeURIComponent(row.id)}`} className="app-link">
                          Inspect JSON
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 className={styles.pageTitle} style={{ fontSize: "1.05rem", marginBottom: 10 }}>
          Recent events
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginTop: 0 }}>
          Quick jump list to keep editing without switching back to PWBS.
        </p>
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
              {recentEvents.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ fontWeight: 600 }}>{row.name ?? row.id}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--color-text-muted)" }}>{row.id}</div>
                  </td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{row.date ?? "—"}</td>
                  <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>
                    {row.status ?? (row.isLive ? "live" : "—")}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      <Link href={`/internal-admin/boxscore/events/${encodeURIComponent(row.id)}/edit`} className="app-link">
                        Edit
                      </Link>
                      <Link href={`/internal-admin/events/${encodeURIComponent(row.id)}`} className="app-link">
                        Inspect
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
