import Link from "next/link";
import styles from "../../internal-admin.module.css";
import { siteAdminSearchEvents } from "@/lib/internalAdmin/siteAdminEvents";
import {
  buildBoxscoreEventsListHref,
  nextSiteAdminEventsLimit,
  parseSiteAdminEventShowFilter,
  parseSiteAdminEventStatusFilter,
  parseSiteAdminEventsLimit,
  SITE_ADMIN_EVENTS_DEFAULT_LIMIT,
  SITE_ADMIN_EVENTS_DEFAULT_STATUS,
} from "@/lib/internalAdmin/boxscoreEventsListParams";
import { isEventResultsPending } from "@/lib/internalAdmin/boxscoreEventListStatus";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import { getEventShowType } from "@/lib/boxscore/eventShowHeader";
import { DeleteBoxscoreEventForm } from "./DeleteBoxscoreEventForm";
import { BoxscoreEventsListToolbar } from "./BoxscoreEventsListToolbar";

export const metadata = { title: "Events — Site admin" };

const editButtonStyle = {
  display: "inline-block",
  padding: "6px 14px",
  fontWeight: 600,
  fontSize: 13,
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--color-blue)",
  color: "#fff",
  textDecoration: "none",
} as const;

const SHOW_BADGE: Record<string, { label: string; bg: string }> = {
  raw: { label: "RAW", bg: "#b91c1c" },
  smackdown: { label: "SD", bg: "#1d4ed8" },
  nxt: { label: "NXT", bg: "#7c3aed" },
  ple: { label: "PLE", bg: "#b45309" },
};

export default async function BoxscoreEventsEditorPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    date?: string;
    id?: string;
    ok?: string;
    status?: string;
    show?: string;
    limit?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const date = sp.date ?? "";
  const id = sp.id ?? "";
  const ok = sp.ok ?? "";
  const status = parseSiteAdminEventStatusFilter(sp.status);
  const show = parseSiteAdminEventShowFilter(sp.show);
  const limit = parseSiteAdminEventsLimit(sp.limit);
  const admin = getServiceRoleClient();

  const result = admin
    ? await siteAdminSearchEvents(admin, { q, date, id, status, show, limit })
    : {
        rows: [],
        error: undefined,
        fetchedCount: 0,
        hasMore: false,
        limit,
        status,
        show,
      };

  const { rows, error, hasMore } = result;

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 8,
        }}
      >
        <div>
          <h1 className={styles.pageTitle} style={{ marginBottom: 8 }}>
            Events
          </h1>
          <p className={styles.intro} style={{ margin: 0, maxWidth: 640 }}>
            Filter by status and show type, then click <strong>Edit event</strong> to manage the card. Default view is{" "}
            <strong>Completed</strong> (includes today&apos;s shows still marked upcoming — <em>results pending</em>).
          </p>
        </div>
        <Link href="/internal-admin/boxscore/events/new" className="admin-article-submit" style={{ textDecoration: "none", flexShrink: 0 }}>
          + Add event
        </Link>
      </div>

      {ok ? (
        <p
          style={{
            marginTop: 16,
            color: "#166534",
            background: "#ecfdf3",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: "10px 12px",
            maxWidth: 760,
          }}
        >
          {ok}
        </p>
      ) : null}

      <section style={{ marginTop: 28 }}>
        {!admin ? (
          <p style={{ color: "var(--color-text-muted)", maxWidth: 520 }}>
            Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to list and manage events.
          </p>
        ) : (
          <>
            <BoxscoreEventsListToolbar
              status={status}
              show={show}
              limit={limit}
              q={q}
              date={date}
              id={id}
              rowCount={rows.length}
              hasMore={hasMore}
            />

            <form
              method="get"
              action="/internal-admin/boxscore/events"
              style={{ display: "grid", gap: 12, marginBottom: 20, maxWidth: 560 }}
            >
              {status === "all" || status !== SITE_ADMIN_EVENTS_DEFAULT_STATUS ? (
                <input type="hidden" name="status" value={status} />
              ) : null}
              {show !== "all" ? <input type="hidden" name="show" value={show} /> : null}
              {limit !== 25 ? <input type="hidden" name="limit" value={String(limit)} /> : null}
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
                Event id (exact)
                <input name="id" defaultValue={id} className="admin-article-input" placeholder="e.g. raw-2026-05-18" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
                Date (YYYY-MM-DD)
                <input name="date" type="text" defaultValue={date} className="admin-article-input" placeholder="2026-05-18" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
                Name contains
                <input name="q" defaultValue={q} className="admin-article-input" placeholder="Royal Rumble, Backlash…" />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <button type="submit" className="admin-article-submit">
                  Search
                </button>
                <Link href={buildBoxscoreEventsListHref({ status, show, limit })} className="app-link" style={{ fontSize: 14 }}>
                  Clear search fields
                </Link>
              </div>
            </form>

            {error ? (
              <p role="alert" style={{ color: "var(--color-red)", background: "var(--color-red-bg)", padding: 12, borderRadius: 6 }}>
                {error}
              </p>
            ) : null}
            {!error && rows.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                No events match these filters. Try <strong>All statuses</strong> / <strong>All shows</strong>, or{" "}
                <Link href="/internal-admin/boxscore/events" className="app-link">
                  reset everything
                </Link>
                .
              </p>
            ) : null}
            {!error && rows.length > 0 ? (
              <>
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
                      {rows.map((row) => {
                        const showType = getEventShowType(row);
                        const badge = SHOW_BADGE[showType];
                        return (
                          <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                            <td style={{ padding: "10px 8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                {badge ? (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: badge.bg,
                                      color: "#fff",
                                      letterSpacing: "0.03em",
                                    }}
                                  >
                                    {badge.label}
                                  </span>
                                ) : null}
                                <Link
                                  href={`/internal-admin/boxscore/events/${encodeURIComponent(row.id)}/edit`}
                                  className="app-link"
                                  style={{ fontWeight: 600, fontSize: 15 }}
                                >
                                  {row.name ?? "—"}
                                </Link>
                                {isEventResultsPending(row) ? (
                                  <span
                                    style={{
                                      color: "#b45309",
                                      fontWeight: 600,
                                      fontSize: 13,
                                      fontStyle: "italic",
                                    }}
                                  >
                                    (results pending)
                                  </span>
                                ) : null}
                              </div>
                              <div
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: 12,
                                  color: "var(--color-text-muted)",
                                  marginTop: 4,
                                }}
                              >
                                {row.id}
                              </div>
                            </td>
                            <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>{row.date ?? "—"}</td>
                            <td style={{ padding: "10px 8px", color: "var(--color-text-muted)" }}>
                              {isEventResultsPending(row) ? "results pending" : (row.status ?? "—")}
                            </td>
                            <td style={{ padding: "10px 8px", minWidth: 280 }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                                <Link
                                  href={`/internal-admin/boxscore/events/${encodeURIComponent(row.id)}/edit`}
                                  style={editButtonStyle}
                                >
                                  Edit event
                                </Link>
                                <Link href={eventResultsHref(row)} className="app-link" target="_blank" rel="noopener noreferrer">
                                  Public page
                                </Link>
                                <Link
                                  href={`/internal-admin/events/${encodeURIComponent(row.id)}`}
                                  className="app-link"
                                  style={{ fontSize: 13 }}
                                >
                                  JSON
                                </Link>
                                <DeleteBoxscoreEventForm eventId={row.id} eventName={row.name ?? row.id} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {hasMore && nextSiteAdminEventsLimit(limit) ? (
                  <p style={{ marginTop: 16 }}>
                    <Link
                      href={buildBoxscoreEventsListHref({
                        q,
                        date,
                        id,
                        status,
                        show,
                        limit: nextSiteAdminEventsLimit(limit)!,
                      })}
                      className="admin-article-submit"
                      style={{ display: "inline-block", textDecoration: "none" }}
                    >
                      Load more events ({nextSiteAdminEventsLimit(limit)} total)
                    </Link>
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </section>

      <p style={{ marginTop: 28, fontSize: 13, color: "var(--color-text-muted)", maxWidth: 560 }}>
        Need raw <code>matches</code> JSON only? Use the{" "}
        <Link href="/internal-admin/events" className="app-link">
          read-only Events inspector
        </Link>
        .
      </p>
    </div>
  );
}
