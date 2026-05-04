import { getLoginNudgeConfigs } from "@/lib/loginNudges";
import { saveLoginNudgeAction } from "./actions";

export const metadata = {
  title: "Login nudges — Site admin",
};

type Props = {
  searchParams: Promise<{ ok?: string; err?: string }>;
};

function NudgeForm({
  nudgeKey,
  title,
  description,
  defaults,
}: {
  nudgeKey: string;
  title: string;
  description: string;
  defaults: {
    enabled: boolean;
    title: string;
    body: string;
    primary_cta_label: string | null;
    primary_cta_href: string | null;
    secondary_cta_label: string | null;
    secondary_cta_href: string | null;
  };
}) {
  return (
    <section style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 14 }}>
      <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: "1.05rem" }}>{title}</h2>
      <p style={{ marginTop: 0, color: "var(--color-text-muted)" }}>{description}</p>
      <form action={saveLoginNudgeAction} style={{ display: "grid", gap: 10 }}>
        <input type="hidden" name="nudge_key" value={nudgeKey} />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input name="enabled" type="checkbox" defaultChecked={defaults.enabled} />
          Enabled
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Title
          <input name="title" defaultValue={defaults.title} className="admin-article-input" maxLength={120} required />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Body
          <textarea
            name="body"
            defaultValue={defaults.body}
            className="admin-article-input"
            rows={3}
            required
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ display: "grid", gap: 6 }}>
            Primary CTA label
            <input
              name="primary_cta_label"
              defaultValue={defaults.primary_cta_label ?? ""}
              className="admin-article-input"
              maxLength={80}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Primary CTA href
            <input
              name="primary_cta_href"
              defaultValue={defaults.primary_cta_href ?? ""}
              className="admin-article-input"
              maxLength={256}
              placeholder="/leagues"
            />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ display: "grid", gap: 6 }}>
            Secondary CTA label
            <input
              name="secondary_cta_label"
              defaultValue={defaults.secondary_cta_label ?? ""}
              className="admin-article-input"
              maxLength={80}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Secondary CTA href
            <input
              name="secondary_cta_href"
              defaultValue={defaults.secondary_cta_href ?? ""}
              className="admin-article-input"
              maxLength={256}
              placeholder="/leagues/new"
            />
          </label>
        </div>
        <button type="submit" className="admin-article-submit" style={{ justifySelf: "start" }}>
          Save nudge
        </button>
      </form>
    </section>
  );
}

export default async function InternalAdminNudgesPage({ searchParams }: Props) {
  const { ok, err } = await searchParams;
  const configs = await getLoginNudgeConfigs();

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>Login nudges</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        Configure pop-up reminders shown after user login when conditional rules match.
      </p>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
        Template variables supported in body: <code>{"{{missing_count}}"}</code>, <code>{"{{league_count}}"}</code>.
      </p>
      {ok ? (
        <p style={{ color: "#166534", background: "#ecfdf3", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}>
          {ok}
        </p>
      ) : null}
      {err ? (
        <p style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px" }}>
          {err}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 14 }}>
        <section style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 14 }}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: "1.05rem" }}>Post-draft roster reminder</h2>
          <p style={{ marginTop: 0, color: "var(--color-text-muted)" }}>
            Users in at least one league with a <strong>completed</strong> draft see a one-time &quot;Check your roster&quot; nudge
            (dismissed permanently in that browser). Copy is fixed in code, not editable here.
          </p>
        </section>
        <NudgeForm
          nudgeKey="missing_draft_prefs"
          title="Nudge: Missing draft preferences"
          description="Shown when a user is in one or more leagues whose draft is not finished yet (excludes completed and ready-for-review) and they have not saved draft preferences for all of those leagues."
          defaults={configs.missing_draft_prefs}
        />
        <NudgeForm
          nudgeKey="no_league_joined"
          title="Nudge: No league joined"
          description="Shown when a user has no league memberships."
          defaults={configs.no_league_joined}
        />
      </div>
    </div>
  );
}
