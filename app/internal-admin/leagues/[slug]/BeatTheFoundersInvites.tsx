import {
  BEAT_THE_FOUNDERS_QUALIFICATION_DEADLINE,
  listBeatTheFoundersQualifiers,
} from "@/lib/beatTheFoundersQualifiers";
import { ensureReusableLeagueInvite, leagueInvitePublicUrl } from "@/lib/leagueInvitePreview";

type Props = {
  leagueId: string;
  leagueSlug: string;
};

export async function BeatTheFoundersInvites({ leagueId, leagueSlug }: Props) {
  const token = await ensureReusableLeagueInvite(leagueId);
  const inviteUrl = token ? leagueInvitePublicUrl(token) : null;

  let qualifiers: Awaited<ReturnType<typeof listBeatTheFoundersQualifiers>> = [];
  let loadError: string | null = null;
  try {
    qualifiers = await listBeatTheFoundersQualifiers(leagueId);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Invitation link</h2>
      <p style={{ margin: "0 0 12px", color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.5, maxWidth: 760 }}>
        Paste this link in the emails you send. It opens league onboarding, where an eligible manager agrees to join,
        then sets up their faction and roster. Accounts that did not win a public league by{" "}
        {BEAT_THE_FOUNDERS_QUALIFICATION_DEADLINE}, and disqualified accounts, are turned away. The link is reusable
        until the league is full.
      </p>
      {inviteUrl ? (
        <input
          readOnly
          value={inviteUrl}
          aria-label="Beat the Founders invitation link"
          style={{
            width: "100%",
            maxWidth: 760,
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
          }}
        />
      ) : (
        <p role="alert" style={{ color: "var(--color-red)" }}>
          Could not create an invitation link.
        </p>
      )}

      <h3 style={{ fontSize: "1rem", margin: "22px 0 8px" }}>Qualified managers</h3>
      <p style={{ margin: "0 0 12px", color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.5, maxWidth: 760 }}>
        Champions of public leagues that ended on or before {BEAT_THE_FOUNDERS_QUALIFICATION_DEADLINE}. Use this list
        when you send the invitation yourself.
      </p>
      {loadError ? (
        <p role="alert" style={{ color: "var(--color-red)" }}>
          {loadError}
        </p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: 8, maxWidth: 860 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "8px 10px" }}>Manager</th>
                <th style={{ padding: "8px 10px" }}>Won</th>
                <th style={{ padding: "8px 10px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {qualifiers.map((row) => (
                <tr key={row.userId} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "8px 10px" }}>
                    <strong>{row.displayName}</strong>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    {row.wins.map((win) => `${win.leagueName} (${win.endDate})`).join(", ")}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>
                    {row.disqualified
                      ? "Disqualified"
                      : row.alreadyMember
                        ? "Already in league"
                        : "Eligible to join"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
