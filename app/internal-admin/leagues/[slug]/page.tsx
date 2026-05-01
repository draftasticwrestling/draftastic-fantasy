import Link from "next/link";
import { notFound } from "next/navigation";
import { siteAdminGetLeagueBySlug } from "@/lib/internalAdmin/siteAdminLeagues";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import {
  adminAddRosterEntryAction,
  adminAddUserToLeagueAction,
  adminApproveDraftReviewAction,
  adminArchiveLeagueAction,
  adminBulkMoveMembersAction,
  adminDeleteLeagueAction,
  adminMoveUserToLeagueAction,
  adminRemoveRosterEntryAction,
  adminRemoveUserFromLeagueAction,
  adminRunAutopickDraftAction,
  adminUnarchiveLeagueAction,
} from "../actions";
import { MemberPovQuickNav } from "./MemberPovQuickNav";
import { RunAutopickSubmitButton } from "./RunAutopickSubmitButton";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${decodeURIComponent(slug)} — League — Site admin` };
}

function draftTypeLabel(value: string | null | undefined): string {
  const t = String(value ?? "").trim().toLowerCase();
  if (!t) return "Autopick (default)";
  if (t === "offline") return "Offline";
  if (t === "autopick") return "Autopick";
  if (t === "snake" || t === "linear") return "Autopick (legacy)";
  return t;
}

export default async function InternalAdminLeagueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ review?: string; ok?: string; err?: string }>;
}) {
  const { slug: raw } = await params;
  const { review = "", ok = "", err = "" } = await searchParams;
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
  const { count: draftOrderRowCount } = await admin
    .from("league_draft_order")
    .select("*", { count: "exact", head: true })
    .eq("league_id", league.id);
  const [rosterRowsRes, wrestlersRes] = await Promise.all([
    admin
      .from("league_rosters")
      .select("user_id, wrestler_id")
      .eq("league_id", league.id)
      .is("released_at", null),
    admin.from("wrestlers").select("id, name, gender").order("name", { ascending: true }),
  ]);
  const rosterRows = (rosterRowsRes.data ?? []) as { user_id: string; wrestler_id: string }[];
  const wrestlers = (wrestlersRes.data ?? []) as { id: string; name: string | null; gender: string | null }[];
  const wrestlerNameById = new Map<string, string>(wrestlers.map((w) => [w.id, w.name ?? w.id]));
  const wrestlerGenderById = new Map<string, "F" | "M" | null>(
    wrestlers.map((w) => {
      const g = String(w.gender ?? "").trim().toLowerCase();
      return [w.id, g === "female" || g === "f" ? "F" : g === "male" || g === "m" ? "M" : null];
    })
  );
  const rosterByUser = new Map<string, string[]>();
  for (const r of rosterRows) {
    const list = rosterByUser.get(r.user_id) ?? [];
    list.push(r.wrestler_id);
    rosterByUser.set(r.user_id, list);
  }
  const rules = getRosterRulesForLeague(members.length, league.season_slug ?? null);
  const rosterWarnings: string[] = [];
  if (rules) {
    for (const m of members) {
      const ids = rosterByUser.get(m.user_id) ?? [];
      let female = 0;
      let male = 0;
      for (const id of ids) {
        const g = wrestlerGenderById.get(id) ?? null;
        if (g === "F") female += 1;
        if (g === "M") male += 1;
      }
      if (ids.length !== rules.rosterSize || female < rules.minFemale || male < rules.minMale) {
        rosterWarnings.push(
          `${m.team_name || m.display_name || m.user_id}: ${ids.length}/${rules.rosterSize} (${female}F/${male}M)`
        );
      }
    }
  }

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
      <p style={{ color: "var(--color-text-muted)", marginBottom: 8, fontFamily: "monospace", fontSize: 14 }}>
        /{league.slug} · id {league.id}
      </p>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, fontSize: 14 }}>
        <strong style={{ color: "var(--color-text)" }}>
          {String(league.visibility_type ?? "").toLowerCase() === "public" ? "Public" : "Private"}
        </strong>
        {league.public_status ? (
          <>
            {" "}
            · status <span style={{ fontFamily: "monospace" }}>{league.public_status}</span>
          </>
        ) : null}
        {league.is_archived ? (
          <>
            {" "}
            · <strong style={{ color: "#92400e" }}>Archived</strong>
            {league.archived_at ? ` (${league.archived_at.slice(0, 10)})` : ""}
          </>
        ) : null}
        {" "}
        ·{" "}
        <strong style={{ color: "var(--color-text)" }}>{league.member_count}</strong>{" "}
        {league.member_count === 1 ? "owner" : "owners"}
        {league.max_teams != null ? (
          <>
            {" "}
            (cap {league.max_teams})
          </>
        ) : null}
      </p>
      {review === "approved" ? (
        <p
          role="status"
          style={{
            marginBottom: 16,
            color: "#0d7d0d",
            background: "#e8f7e8",
            border: "1px solid #9ad49a",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          Draft approved. League members can now view rosters.
        </p>
      ) : null}
      {ok ? (
        <p
          role="status"
          style={{
            marginBottom: 16,
            color: "#0d7d0d",
            background: "#e8f7e8",
            border: "1px solid #9ad49a",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          {ok}
        </p>
      ) : null}
      {err ? (
        <p
          role="alert"
          style={{
            marginBottom: 16,
            color: "var(--color-red)",
            background: "var(--color-red-bg)",
            border: "1px solid var(--color-red)",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          {err}
        </p>
      ) : null}
      {review === "note-required" ? (
        <p
          role="alert"
          style={{
            marginBottom: 16,
            color: "#8b5a00",
            background: "#fff8e5",
            border: "1px solid #e0a400",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          Add a review note to approve when roster warnings are present.
        </p>
      ) : null}
      {review === "error" || review === "invalid" ? (
        <p
          role="alert"
          style={{
            marginBottom: 16,
            color: "var(--color-red)",
            background: "var(--color-red-bg)",
            border: "1px solid var(--color-red)",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          Could not approve draft. Refresh and try again.
        </p>
      ) : null}

      <MemberPovQuickNav
        leagueSlug={league.slug}
        members={members.map((m) => ({
          user_id: m.user_id,
          role: m.role,
          team_name: m.team_name ?? null,
          display_name: m.display_name ?? null,
        }))}
      />

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
          <dt style={{ color: "var(--color-text-muted)" }}>Draft status</dt>
          <dd style={{ margin: 0 }}>
            {league.draft_status === "ready_for_review"
              ? "Ready for review"
              : league.draft_status === "in_progress"
                ? "In progress"
                : league.draft_status === "completed"
                  ? "Completed (approved)"
                  : league.draft_status ?? "not_started"}
          </dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Draft type</dt>
          <dd style={{ margin: 0 }}>{draftTypeLabel(league.draft_type)}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Pick order</dt>
          <dd style={{ margin: 0 }}>
            {(league.draft_order_method ?? "random_one_hour_before") === "manual_by_gm"
              ? "Manual (GM)"
              : "Randomize ~1h before draft"}
            {" · "}
            <strong>{draftOrderRowCount ?? 0}</strong> slots in <code>league_draft_order</code>
          </dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Format</dt>
          <dd style={{ margin: 0 }}>
            {league.league_type ?? "—"}
            {league.max_teams != null ? ` · max ${league.max_teams} teams` : ""}
          </dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Include NXT</dt>
          <dd style={{ margin: 0 }}>{league.include_nxt ? "Yes" : "No"}</dd>
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
                <th style={{ padding: "10px 8px" }}>Draft prefs</th>
                <th style={{ padding: "10px 8px" }}>Actions</th>
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
                  <td style={{ padding: "10px 8px" }}>{m.has_draft_preferences ? "Set" : "Not set"}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <form action={adminRemoveUserFromLeagueAction}>
                      <input type="hidden" name="leagueId" value={league.id} />
                      <input type="hidden" name="leagueSlug" value={league.slug} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <button type="submit" className="admin-article-submit" style={{ padding: "4px 8px", fontSize: 12 }}>
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Membership admin tools</h2>
        <div style={{ display: "grid", gap: 14 }}>
          <form action={adminAddUserToLeagueAction} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, display: "grid", gap: 8, maxWidth: 620 }}>
            <input type="hidden" name="leagueId" value={league.id} />
            <input type="hidden" name="leagueSlug" value={league.slug} />
            <label>
              <div style={{ marginBottom: 4 }}>Add user (user id or email)</div>
              <input className="admin-article-input" name="userInput" required placeholder="uuid or user@email.com" />
            </label>
            <label>
              <div style={{ marginBottom: 4 }}>Role</div>
              <select className="admin-article-input" name="role" defaultValue="owner">
                <option value="owner">Owner</option>
                <option value="commissioner">Commissioner</option>
              </select>
            </label>
            <button type="submit" className="admin-article-submit" style={{ width: "fit-content" }}>
              Add member
            </button>
          </form>

          <form action={adminMoveUserToLeagueAction} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, display: "grid", gap: 8, maxWidth: 620 }}>
            <input type="hidden" name="sourceLeagueId" value={league.id} />
            <input type="hidden" name="sourceLeagueSlug" value={league.slug} />
            <label>
              <div style={{ marginBottom: 4 }}>User id to move</div>
              <input className="admin-article-input" name="userId" required placeholder="User id from member list" />
            </label>
            <label>
              <div style={{ marginBottom: 4 }}>Target league slug</div>
              <input className="admin-article-input" name="targetLeagueSlug" required placeholder="r2summer-2" />
            </label>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13 }}>
              Move removes the user from this league, adds them as owner to target, clears source draft prefs, and closes
              active source roster stints.
            </p>
            <button type="submit" className="admin-article-submit" style={{ width: "fit-content" }}>
              Move member to another league
            </button>
          </form>

          <form action={adminBulkMoveMembersAction} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, display: "grid", gap: 8, maxWidth: 620 }}>
            <input type="hidden" name="sourceLeagueId" value={league.id} />
            <input type="hidden" name="sourceLeagueSlug" value={league.slug} />
            <label>
              <div style={{ marginBottom: 4 }}>Bulk move target league slug</div>
              <input className="admin-article-input" name="targetLeagueSlug" required placeholder="r2summer-2" />
            </label>
            <label>
              <div style={{ marginBottom: 4 }}>Max members to move (1-32)</div>
              <input className="admin-article-input" name="maxMoves" type="number" min={1} max={32} defaultValue={6} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" name="includeCommissioner" />
              <span>Include commissioner in bulk move</span>
            </label>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13 }}>
              Safeguards: respects target league cap, avoids duplicates, and won&apos;t orphan commissioner.
            </p>
            <button type="submit" className="admin-article-submit" style={{ width: "fit-content" }}>
              Bulk move members
            </button>
          </form>
        </div>
      </section>
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: 10 }}>Run autopick (site admin)</h2>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 12, fontSize: 14, lineHeight: 1.5 }}>
          Runs the full autopick in the background (no live draft room). Members do not see rosters until status is{" "}
          <strong>ready for review</strong> and an admin <strong>approves</strong> below. Only one autopick may be{" "}
          <strong>in progress</strong> at a time across the site; the scheduled cron also starts at most one new draft
          per run.
        </p>
        {String(league.draft_type ?? "").toLowerCase() === "autopick" && league.draft_status === "not_started" ? (
          <form action={adminRunAutopickDraftAction} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
            <input type="hidden" name="leagueId" value={league.id} />
            <input type="hidden" name="leagueSlug" value={league.slug} />
            {(league.draft_order_method ?? "random_one_hour_before") === "manual_by_gm" && (draftOrderRowCount ?? 0) === 0 ? (
              <p role="alert" style={{ margin: 0, color: "#92400e", fontSize: 14 }}>
                Pick order is empty. The commissioner must set round-1 / full order before you can run autopick.
              </p>
            ) : (
              <>
                <RunAutopickSubmitButton />
                <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13 }}>
                  After you click, this can take ~10-30 seconds for larger leagues. The page will reload with a
                  success or error banner.
                </p>
              </>
            )}
          </form>
        ) : String(league.draft_type ?? "").toLowerCase() === "autopick" && league.draft_status === "in_progress" ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
            Autopick is in progress. Refresh this page or call the scheduled-drafts cron with <code>CRON_SECRET</code> to
            advance picks if it does not finish in one request.
          </p>
        ) : String(league.draft_type ?? "").toLowerCase() !== "autopick" ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>This league is not an autopick league.</p>
        ) : (
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
            Autopick has already finished or been approved (status: {league.draft_status ?? "—"}).
          </p>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: 10 }}>Draft review &amp; approve</h2>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 12 }}>
          Status:{" "}
          <strong>
            {league.draft_status === "ready_for_review" ? "Ready for review" : league.draft_status ?? "not_started"}
          </strong>
        </p>
        {league.draft_status === "ready_for_review" ? (
          <>
            {rosterWarnings.length > 0 && (
              <div
                style={{
                  border: "1px solid #e0a400",
                  background: "#fff8e5",
                  color: "#8b5a00",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 12,
                }}
              >
                <p style={{ margin: "0 0 6px", fontWeight: 600 }}>
                  Warning: one or more rosters do not meet size/minimum requirements.
                </p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {rosterWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                  You can still approve, but add a note.
                </p>
              </div>
            )}
            <form action={adminApproveDraftReviewAction} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640 }}>
              <input type="hidden" name="leagueId" value={league.id} />
              <input type="hidden" name="leagueSlug" value={league.slug} />
              <textarea
                name="reviewNote"
                rows={3}
                placeholder={rosterWarnings.length > 0 ? "Required note when approving with warnings…" : "Optional review note…"}
                className="admin-article-input"
                style={{ width: "100%" }}
              />
              <button type="submit" className="admin-article-submit" style={{ width: "fit-content" }}>
                Approve draft
              </button>
            </form>
          </>
        ) : league.draft_status === "completed" ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
            Draft is approved. League members can view rosters and scoring.
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
            Approve appears here after autopick completes and status is <strong>ready for review</strong>. Until then,
            members see empty rosters (admins can still use POV links and roster tools below).
          </p>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Roster corrections</h2>
        {members.map((m) => {
          const ids = rosterByUser.get(m.user_id) ?? [];
          const label = m.team_name || m.display_name || m.user_id;
          return (
            <div key={m.user_id} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{label}</p>
              <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
                {ids.length === 0 ? (
                  <li style={{ color: "var(--color-text-muted)" }}>No active wrestlers.</li>
                ) : (
                  ids.map((wid) => (
                    <li key={`${m.user_id}-${wid}`} style={{ marginBottom: 6 }}>
                      {wrestlerNameById.get(wid) ?? wid}
                      <form action={adminRemoveRosterEntryAction} style={{ display: "inline-block", marginLeft: 8 }}>
                        <input type="hidden" name="leagueId" value={league.id} />
                        <input type="hidden" name="leagueSlug" value={league.slug} />
                        <input type="hidden" name="userId" value={m.user_id} />
                        <input type="hidden" name="wrestlerId" value={wid} />
                        <button type="submit" className="admin-article-submit" style={{ padding: "2px 8px", fontSize: 12 }}>
                          Remove
                        </button>
                      </form>
                    </li>
                  ))
                )}
              </ul>
              <form action={adminAddRosterEntryAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="hidden" name="leagueId" value={league.id} />
                <input type="hidden" name="leagueSlug" value={league.slug} />
                <input type="hidden" name="userId" value={m.user_id} />
                <select name="wrestlerId" className="admin-article-input" defaultValue="" style={{ minWidth: 240 }}>
                  <option value="" disabled>
                    Add wrestler…
                  </option>
                  {wrestlers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name ?? w.id}
                    </option>
                  ))}
                </select>
                <button type="submit" className="admin-article-submit">
                  Add
                </button>
              </form>
            </div>
          );
        })}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Lifecycle admin</h2>
        <div style={{ display: "grid", gap: 14 }}>
          <form action={league.is_archived ? adminUnarchiveLeagueAction : adminArchiveLeagueAction} style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 12, display: "grid", gap: 8, maxWidth: 620 }}>
            <input type="hidden" name="leagueId" value={league.id} />
            <input type="hidden" name="leagueSlug" value={league.slug} />
            {league.is_archived ? (
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                Archived leagues are hidden from normal user league lists and nav, but preserved for history.
              </p>
            ) : (
              <label>
                <div style={{ marginBottom: 4 }}>Archive reason</div>
                <input className="admin-article-input" name="reason" required placeholder="Season complete; hide from active lists" />
              </label>
            )}
            <button type="submit" className="admin-article-submit" style={{ width: "fit-content" }}>
              {league.is_archived ? "Unarchive league" : "Archive league"}
            </button>
          </form>

          <form action={adminDeleteLeagueAction} style={{ border: "1px solid #fecaca", borderRadius: 8, padding: 12, display: "grid", gap: 8, maxWidth: 620, background: "#fff7f7" }}>
            <input type="hidden" name="leagueId" value={league.id} />
            <input type="hidden" name="leagueSlug" value={league.slug} />
            <label>
              <div style={{ marginBottom: 4 }}>Delete reason (required)</div>
              <input className="admin-article-input" name="reason" required placeholder="Duplicate test league" />
            </label>
            <label>
              <div style={{ marginBottom: 4 }}>Type league slug to confirm</div>
              <input className="admin-article-input" name="confirmSlug" required placeholder={league.slug} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" name="forceDelete" />
              <span>Force delete even when multiple members exist (after review)</span>
            </label>
            <p style={{ margin: 0, color: "#991b1b", fontSize: 13 }}>
              Permanent action. If this league has important history, archive it instead.
            </p>
            <button type="submit" className="admin-article-submit" style={{ width: "fit-content", background: "#b91c1c" }}>
              Delete league permanently
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
