import Link from "next/link";
import { breakingNewsAdminStatus, listBreakingNewsForAdmin } from "@/lib/breakingNews";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import styles from "../internal-admin.module.css";

export const metadata = {
  title: "Breaking news — Site admin",
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#166534", bg: "#ecfdf3" },
  scheduled: { label: "Scheduled", color: "#92400e", bg: "#fffbeb" },
  expired: { label: "Expired", color: "#6b7280", bg: "#f3f4f6" },
  disabled: { label: "Disabled", color: "#991b1b", bg: "#fef2f2" },
};

type Props = {
  searchParams: Promise<{ ok?: string; err?: string }>;
};

export default async function InternalAdminBreakingNewsPage({ searchParams }: Props) {
  const { ok, err } = await searchParams;
  const admin = getServiceRoleClient();
  const rows = admin ? await listBreakingNewsForAdmin() : [];

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>
          Breaking news
        </h1>
        <Link
          href="/internal-admin/breaking-news/new"
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
          New item
        </Link>
      </div>
      <p style={{ color: "var(--color-text-muted)", marginTop: 12, marginBottom: 24, maxWidth: 640 }}>
        Manage the homepage chyron shown below the blue hero banner. Multiple active items scroll in the ticker.
        Leave start/end empty to show immediately until disabled.
      </p>

      {!admin ? (
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16, fontSize: 14 }}>
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to load and edit breaking news.
        </p>
      ) : null}

      {ok ? (
        <p style={{ color: "#166534", background: "#ecfdf3", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}>
          {decodeURIComponent(ok.replace(/\+/g, " "))}
        </p>
      ) : null}
      {err ? (
        <p style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px" }}>
          {decodeURIComponent(err.replace(/\+/g, " "))}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No breaking news items yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>Message</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
                <th style={{ padding: "10px 8px" }}>Sort</th>
                <th style={{ padding: "10px 8px" }}>Schedule</th>
                <th style={{ padding: "10px 8px" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = breakingNewsAdminStatus(row);
                const badge = STATUS_STYLE[status] ?? STATUS_STYLE.disabled;
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "12px 8px", maxWidth: 360 }}>
                      <div style={{ fontWeight: 600 }}>{row.message}</div>
                      {row.link_href ? (
                        <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 4 }}>
                          → {row.link_href}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          color: badge.color,
                          background: badge.bg,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px" }}>{row.sort_order}</td>
                    <td style={{ padding: "12px 8px", color: "var(--color-text-muted)", fontSize: 12 }}>
                      {row.starts_at ? `From ${new Date(row.starts_at).toLocaleString()}` : "Now"}
                      <br />
                      {row.ends_at ? `Until ${new Date(row.ends_at).toLocaleString()}` : "No end"}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <Link href={`/internal-admin/breaking-news/${row.id}/edit`} className="app-link">
                        Edit
                      </Link>
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
