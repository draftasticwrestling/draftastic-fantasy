import Link from "next/link";
import { notFound } from "next/navigation";
import { siteAdminGetUserDetail } from "@/lib/internalAdmin/siteAdminUsers";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import {
  clearAvatarAction,
  saveUserModerationAction,
  setSuspensionAction,
  updateLeagueMembershipTextAction,
} from "../actions";
import styles from "../../internal-admin.module.css";

export const metadata = {
  title: "User moderation — Site admin",
};

export default async function InternalAdminUserModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { userId } = await params;
  const { ok, err } = await searchParams;
  const admin = getServiceRoleClient();
  if (!admin) {
    return (
      <div>
        <h1 className={styles.pageTitle}>User moderation</h1>
        <p style={{ color: "var(--color-text-muted)", maxWidth: 520 }}>
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> in the server environment for user moderation tools.
        </p>
      </div>
    );
  }

  const { detail, error } = await siteAdminGetUserDetail(admin, userId);
  if (error) {
    return (
      <div>
        <h1 className={styles.pageTitle}>User moderation</h1>
        <p role="alert" style={{ color: "var(--color-red)" }}>
          {error}
        </p>
      </div>
    );
  }
  if (!detail) notFound();
  const suspensionLabel = !detail.is_suspended
    ? "Active"
    : detail.suspended_until
      ? `Temporarily suspended until ${detail.suspended_until.slice(0, 16).replace("T", " ")}`
      : "Permanently blocked";

  return (
    <div style={{ maxWidth: 1080 }}>
      <p style={{ marginBottom: 12 }}>
        <Link href="/internal-admin/users" className="app-link">
          ← Back to Users
        </Link>
      </p>
      <h1 className={styles.pageTitle}>User moderation</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 20 }}>
        {detail.display_name ?? "—"} · {detail.email ?? "No email"} · {detail.id}
      </p>

      {ok ? (
        <p style={{ color: "#166534", background: "#ecfdf3", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}>{ok}</p>
      ) : null}
      {err ? (
        <p style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px" }}>{err}</p>
      ) : null}

      <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--color-border)", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0 }}>Account overview</h2>
        <div style={{ display: "grid", gap: 6, color: "var(--color-text-muted)" }}>
          <div>Created: {detail.created_at ? detail.created_at.slice(0, 10) : "—"}</div>
          <div>Last sign-in: {detail.last_sign_in_at ? detail.last_sign_in_at.slice(0, 10) : "—"}</div>
          <div>Leagues: {detail.memberships.length}</div>
          <div>Draft preferences saved: {detail.draft_pref_count > 0 ? `Yes (${detail.draft_pref_count})` : "No"}</div>
          <div>Timezone: {detail.timezone ?? "—"}</div>
          <div>Marketing opt-in: {detail.marketing_opt_in ? "Yes" : "No"}</div>
          <div>
            Marketing opt-in date: {detail.marketing_opt_in_at ? detail.marketing_opt_in_at.slice(0, 10) : "—"}
          </div>
          <div>Terms accepted: {detail.accepted_terms_at ? detail.accepted_terms_at.slice(0, 10) : "No"}</div>
          <div>Privacy accepted: {detail.accepted_privacy_at ? detail.accepted_privacy_at.slice(0, 10) : "No"}</div>
        </div>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--color-border)", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0 }}>Core moderation</h2>
        <form action={saveUserModerationAction} style={{ display: "grid", gap: 12, maxWidth: 640 }}>
          <input type="hidden" name="user_id" value={detail.id} />
          <label>
            <div style={{ marginBottom: 4 }}>Display name</div>
            <input className="admin-article-input" name="display_name" defaultValue={detail.display_name ?? ""} />
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" name="is_site_admin" defaultChecked={detail.is_site_admin} />
            <span>Site admin</span>
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Internal moderation note</div>
            <textarea className="admin-article-input" name="moderation_note" defaultValue={detail.moderation_note ?? ""} rows={4} />
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Reason (required)</div>
            <input className="admin-article-input" name="reason" required placeholder="Why this change is needed" />
          </label>
          <button className="admin-article-submit" type="submit">
            Save moderation fields
          </button>
        </form>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--color-border)", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0 }}>Suspension</h2>
        <p style={{ color: "var(--color-text-muted)" }}>
          Status: {suspensionLabel}
          {detail.suspension_reason ? ` — ${detail.suspension_reason}` : ""}
        </p>

        <form action={setSuspensionAction} style={{ display: "grid", gap: 10, maxWidth: 640, marginBottom: 14 }}>
          <input type="hidden" name="user_id" value={detail.id} />
          <input type="hidden" name="mode" value="suspend" />
          <label>
            <div style={{ marginBottom: 4 }}>Suspend until (optional)</div>
            <input type="datetime-local" className="admin-article-input" name="suspended_until" />
          </label>
          <label>
            <div style={{ marginBottom: 4 }}>Reason (required)</div>
            <input className="admin-article-input" name="reason" required placeholder="Reason for suspension" />
          </label>
          <button className="admin-article-submit" type="submit">
            Suspend user
          </button>
        </form>

        <form action={setSuspensionAction} style={{ display: "grid", gap: 10, maxWidth: 640, marginBottom: 14 }}>
          <input type="hidden" name="user_id" value={detail.id} />
          <input type="hidden" name="mode" value="permanent_block" />
          <label>
            <div style={{ marginBottom: 4 }}>Reason for permanent block (required)</div>
            <input className="admin-article-input" name="reason" required placeholder="Reason for permanent block" />
          </label>
          <button className="admin-article-submit" type="submit">
            Permanently block user
          </button>
        </form>

        <form action={setSuspensionAction} style={{ display: "grid", gap: 10, maxWidth: 640 }}>
          <input type="hidden" name="user_id" value={detail.id} />
          <input type="hidden" name="mode" value="unsuspend" />
          <label>
            <div style={{ marginBottom: 4 }}>Reason for unsuspension (required)</div>
            <input className="admin-article-input" name="reason" required placeholder="Reason for restoring access" />
          </label>
          <button className="admin-article-submit" type="submit">
            Unsuspend user
          </button>
        </form>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--color-border)", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0 }}>Avatar moderation</h2>
        <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
          Current avatar: {detail.avatar_url ? "Set" : "None"}
        </p>
        {detail.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.avatar_url} alt="" style={{ width: 52, height: 52, borderRadius: 999, objectFit: "cover", marginBottom: 12 }} />
        ) : null}
        <form action={clearAvatarAction} style={{ display: "grid", gap: 10, maxWidth: 640 }}>
          <input type="hidden" name="user_id" value={detail.id} />
          <label>
            <div style={{ marginBottom: 4 }}>Reason (required)</div>
            <input className="admin-article-input" name="reason" required placeholder="Reason for removing avatar" />
          </label>
          <button className="admin-article-submit" type="submit">
            Clear avatar
          </button>
        </form>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--color-border)", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0 }}>League text moderation</h2>
        {detail.memberships.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>User is not in any leagues.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {detail.memberships.map((m) => (
              <form
                key={m.league_id}
                action={updateLeagueMembershipTextAction}
                style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}
              >
                <input type="hidden" name="user_id" value={detail.id} />
                <input type="hidden" name="league_id" value={m.league_id} />
                <div style={{ fontWeight: 600 }}>
                  <Link href={`/internal-admin/leagues/${encodeURIComponent(m.league_slug)}`} className="app-link">
                    {m.league_name}
                  </Link>{" "}
                  <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>· role: {m.role}</span>
                </div>
                <label>
                  <div style={{ marginBottom: 4 }}>Team name</div>
                  <input className="admin-article-input" name="team_name" defaultValue={m.team_name ?? ""} />
                </label>
                <label>
                  <div style={{ marginBottom: 4 }}>Manager catchphrase</div>
                  <input className="admin-article-input" name="manager_catchphrase" defaultValue={m.manager_catchphrase ?? ""} />
                </label>
                <label>
                  <div style={{ marginBottom: 4 }}>Reason (required)</div>
                  <input className="admin-article-input" name="reason" required placeholder="Reason for editing league text" />
                </label>
                <button className="admin-article-submit" type="submit">
                  Save league text
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid var(--color-border)", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0 }}>Recent moderation audit</h2>
        {detail.audit.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>No moderation actions logged yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "8px 6px" }}>When</th>
                <th style={{ padding: "8px 6px" }}>Action</th>
                <th style={{ padding: "8px 6px" }}>Reason</th>
                <th style={{ padding: "8px 6px" }}>Actor</th>
              </tr>
            </thead>
            <tbody>
              {detail.audit.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "8px 6px", color: "var(--color-text-muted)" }}>{a.created_at.slice(0, 16).replace("T", " ")}</td>
                  <td style={{ padding: "8px 6px" }}>{a.action}</td>
                  <td style={{ padding: "8px 6px" }}>{a.reason ?? "—"}</td>
                  <td style={{ padding: "8px 6px", color: "var(--color-text-muted)", fontFamily: "monospace" }}>{a.actor_user_id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
