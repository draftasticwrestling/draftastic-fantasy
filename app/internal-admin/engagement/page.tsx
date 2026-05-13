import Link from "next/link";
import { getServiceRoleClient } from "@/lib/internalAdmin/serviceClient";
import {
  distinctUserIdsForEngagementEvent,
  fetchDailyEngagementTrend,
  fetchSeasonEngagementKpiCounts,
  paginateContentEngagementRows,
  paginateSeasonEngagementRows,
  type EngagementRow,
} from "@/lib/internalAdmin/engagementStats";

export const metadata = {
  title: "Season engagement — Site admin",
};

type Row = EngagementRow;

function uniqUsers(rows: Row[], predicate?: (r: Row) => boolean): number {
  const users = new Set(
    rows
      .filter((r) => (predicate ? predicate(r) : true))
      .map((r) => r.user_id)
      .filter((id): id is string => Boolean(id))
  );
  return users.size;
}

function count(rows: Row[], eventName: string): number {
  return rows.filter((r) => r.event_name === eventName).length;
}

async function getEmailByUserIds(
  admin: ReturnType<typeof getServiceRoleClient>,
  userIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const remaining = new Set(userIds);
  if (!admin || remaining.size === 0) return out;

  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) break;
    const users = data?.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      if (!remaining.has(u.id)) continue;
      const email = (u.email ?? "").trim();
      if (email) out.set(u.id, email);
      remaining.delete(u.id);
    }
    if (remaining.size === 0) break;
  }
  return out;
}

export default async function InternalAdminEngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; sort?: string; dir?: string }>;
}) {
  const { season: seasonParam = "", sort: sortParam = "total", dir: dirParam = "desc" } = await searchParams;
  const admin = getServiceRoleClient();
  if (!admin) {
    return (
      <div>
        <h1 style={{ marginTop: 0 }}>Season engagement</h1>
        <p style={{ color: "var(--color-text-muted)" }}>
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to read engagement analytics.
        </p>
      </div>
    );
  }

  const { data: seasonRows } = await admin
    .from("leagues")
    .select("season_slug")
    .not("season_slug", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  const seasons = Array.from(
    new Set(
      ((seasonRows ?? []) as { season_slug?: string | null }[])
        .map((r) => (r.season_slug ?? "").trim())
        .filter(Boolean)
    )
  );
  const season = seasonParam && seasons.includes(seasonParam) ? seasonParam : (seasons[0] ?? "");

  const USER_TABLE_LOOKBACK_DAYS = 120;
  const sinceForUserIso = new Date(
    Date.now() - USER_TABLE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  let rows: Row[] = [];
  let contentRows: Row[] = [];
  let dailyRows: Array<{
    day: string;
    signIns: number;
    faAdds: number;
    drops: number;
    tradesExecuted: number;
    loggedInViews: number;
    articleViews: number;
    resultsViews: number;
  }> = [];
  let kpiCounts: Awaited<ReturnType<typeof fetchSeasonEngagementKpiCounts>> | null = null;
  let signInUserIds = new Set<string>();
  let articleViewUserIds = new Set<string>();
  let resultsViewUserIds = new Set<string>();

  if (season) {
    const [counts, trend, sUsers, aUsers, rUsers, seasonRows, contentPaged] = await Promise.all([
      fetchSeasonEngagementKpiCounts(admin, season),
      fetchDailyEngagementTrend(admin, season, 21),
      distinctUserIdsForEngagementEvent(admin, { eventName: "auth.sign_in", seasonSlug: season }),
      distinctUserIdsForEngagementEvent(admin, { eventName: "page.news_article_view", seasonSlug: null }),
      distinctUserIdsForEngagementEvent(admin, { eventName: "page.event_results_view", seasonSlug: null }),
      paginateSeasonEngagementRows(admin, season, sinceForUserIso),
      paginateContentEngagementRows(admin, sinceForUserIso),
    ]);
    kpiCounts = counts;
    dailyRows = trend;
    signInUserIds = sUsers;
    articleViewUserIds = aUsers;
    resultsViewUserIds = rUsers;
    rows = seasonRows;
    contentRows = contentPaged;
  } else {
    const eventsQuery = admin
      .from("engagement_events")
      .select("event_name, user_id, occurred_at, path")
      .order("occurred_at", { ascending: false })
      .limit(50000);
    const { data: rawEvents } = await eventsQuery;
    rows = (rawEvents ?? []) as Row[];
    const { data: rawContentViews } = await admin
      .from("engagement_events")
      .select("event_name, user_id, occurred_at, path")
      .in("event_name", ["page.news_article_view", "page.event_results_view"])
      .order("occurred_at", { ascending: false })
      .limit(50000);
    contentRows = (rawContentViews ?? []) as Row[];
    const dailyByDate = new Map<
      string,
      {
        signIns: number;
        faAdds: number;
        drops: number;
        tradesExecuted: number;
        loggedInViews: number;
        articleViews: number;
        resultsViews: number;
      }
    >();
    const emptyDay = () => ({
      signIns: 0,
      faAdds: 0,
      drops: 0,
      tradesExecuted: 0,
      loggedInViews: 0,
      articleViews: 0,
      resultsViews: 0,
    });
    for (const r of rows) {
      const day = r.occurred_at.slice(0, 10);
      const bucket = dailyByDate.get(day) ?? emptyDay();
      if (r.event_name === "auth.sign_in") bucket.signIns += 1;
      if (r.event_name === "league.fa_add") bucket.faAdds += 1;
      if (r.event_name === "league.drop") bucket.drops += 1;
      if (r.event_name === "league.trade_executed") bucket.tradesExecuted += 1;
      if (r.event_name === "page.logged_in_view") bucket.loggedInViews += 1;
      dailyByDate.set(day, bucket);
    }
    for (const r of contentRows) {
      const day = r.occurred_at.slice(0, 10);
      const bucket = dailyByDate.get(day) ?? emptyDay();
      if (r.event_name === "page.news_article_view") bucket.articleViews += 1;
      if (r.event_name === "page.event_results_view") bucket.resultsViews += 1;
      dailyByDate.set(day, bucket);
    }
    dailyRows = Array.from(dailyByDate.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, 21);
  }

  const sortKey = String(sortParam || "total");
  const sortDir: "asc" | "desc" = dirParam === "asc" ? "asc" : "desc";

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const rowsDay = rows.filter((r) => Date.parse(r.occurred_at) >= dayAgo);
  const rowsWeek = rows.filter((r) => Date.parse(r.occurred_at) >= weekAgo);
  const rowsMonth = rows.filter((r) => Date.parse(r.occurred_at) >= monthAgo);

  const kpi = kpiCounts
    ? {
        signIns: kpiCounts.signIns,
        signInsUnique: signInUserIds.size,
        faAdds: kpiCounts.faAdds,
        drops: kpiCounts.drops,
        tradesProposed: kpiCounts.tradesProposed,
        tradesExecuted: kpiCounts.tradesExecuted,
        myFactionViews: kpiCounts.myFactionViews,
        freeAgentsViews: kpiCounts.freeAgentsViews,
        leadersViews: kpiCounts.leadersViews,
        loggedInViews: kpiCounts.loggedInViews,
        sessionStarts: kpiCounts.sessionStarts,
        articleViews: kpiCounts.articleViews,
        articleViewsUnique: articleViewUserIds.size,
        resultsViews: kpiCounts.resultsViews,
        resultsViewsUnique: resultsViewUserIds.size,
        dau: uniqUsers(rowsDay),
        wau: uniqUsers(rowsWeek),
        mau: uniqUsers(rowsMonth),
      }
    : {
        signIns: count(rows, "auth.sign_in"),
        signInsUnique: uniqUsers(rows, (r) => r.event_name === "auth.sign_in"),
        faAdds: count(rows, "league.fa_add"),
        drops: count(rows, "league.drop"),
        tradesProposed: count(rows, "league.trade_proposed"),
        tradesExecuted: count(rows, "league.trade_executed"),
        myFactionViews: count(rows, "page.my_faction_view"),
        freeAgentsViews: count(rows, "page.free_agents_view"),
        leadersViews: count(rows, "page.league_leaders_view"),
        loggedInViews: count(rows, "page.logged_in_view"),
        sessionStarts: count(rows, "session.logged_in_start"),
        articleViews: count(contentRows, "page.news_article_view"),
        articleViewsUnique: uniqUsers(contentRows, (r) => r.event_name === "page.news_article_view"),
        resultsViews: count(contentRows, "page.event_results_view"),
        resultsViewsUnique: uniqUsers(contentRows, (r) => r.event_name === "page.event_results_view"),
        dau: uniqUsers(rowsDay),
        wau: uniqUsers(rowsWeek),
        mau: uniqUsers(rowsMonth),
      };

  const { data: leaguesInSeason } = season
    ? await admin.from("leagues").select("id").eq("season_slug", season).limit(4000)
    : await admin.from("leagues").select("id").limit(0);
  const seasonLeagueIds = ((leaguesInSeason ?? []) as { id?: string }[])
    .map((r) => r.id ?? "")
    .filter(Boolean);

  const { data: membersRows } =
    seasonLeagueIds.length > 0
      ? await admin
          .from("league_members")
          .select("user_id, display_name, team_name, league_id")
          .in("league_id", seasonLeagueIds)
      : { data: [] };

  const seasonMembers = (membersRows ?? []) as Array<{
    user_id: string;
    display_name?: string | null;
    team_name?: string | null;
    league_id?: string | null;
  }>;
  const seasonUserIds = Array.from(new Set(seasonMembers.map((m) => m.user_id).filter(Boolean)));
  const eventUserIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((id): id is string => Boolean(id)))
  );
  const contentEventUserIds = Array.from(
    new Set(contentRows.map((r) => r.user_id).filter((id): id is string => Boolean(id)))
  );
  const allUserIds = Array.from(new Set([...seasonUserIds, ...eventUserIds, ...contentEventUserIds]));

  const memberNameByUser = new Map<string, string>();
  for (const m of seasonMembers) {
    if (!m.user_id) continue;
    const preferred = (m.team_name ?? "").trim() || (m.display_name ?? "").trim();
    if (preferred && !memberNameByUser.has(m.user_id)) memberNameByUser.set(m.user_id, preferred);
  }
  const emailByUser = await getEmailByUserIds(admin, allUserIds);

  type UserAgg = {
    userId: string;
    displayName: string | null;
    email: string | null;
    total: number;
    signIns: number;
    faAdds: number;
    drops: number;
    tradesProposed: number;
    tradesExecuted: number;
    myFactionViews: number;
    freeAgentsViews: number;
    leadersViews: number;
    loggedInViews: number;
    sessionStarts: number;
    articleViews: number;
    resultsViews: number;
    lastSeen: string | null;
  };

  const userAggMap = new Map<string, UserAgg>();
  function ensureUserAgg(userId: string): UserAgg {
    const existing = userAggMap.get(userId);
    if (existing) return existing;
    const created: UserAgg = {
      userId,
      displayName: memberNameByUser.get(userId) ?? null,
      email: emailByUser.get(userId) ?? null,
      total: 0,
      signIns: 0,
      faAdds: 0,
      drops: 0,
      tradesProposed: 0,
      tradesExecuted: 0,
      myFactionViews: 0,
      freeAgentsViews: 0,
      leadersViews: 0,
      loggedInViews: 0,
      sessionStarts: 0,
      articleViews: 0,
      resultsViews: 0,
      lastSeen: null,
    };
    userAggMap.set(userId, created);
    return created;
  }

  for (const userId of allUserIds) ensureUserAgg(userId);
  for (const r of rows) {
    if (!r.user_id) continue;
    const agg = ensureUserAgg(r.user_id);
    agg.total += 1;
    if (!agg.lastSeen || r.occurred_at > agg.lastSeen) agg.lastSeen = r.occurred_at;
    if (r.event_name === "auth.sign_in") agg.signIns += 1;
    if (r.event_name === "league.fa_add") agg.faAdds += 1;
    if (r.event_name === "league.drop") agg.drops += 1;
    if (r.event_name === "league.trade_proposed") agg.tradesProposed += 1;
    if (r.event_name === "league.trade_executed") agg.tradesExecuted += 1;
    if (r.event_name === "page.my_faction_view") agg.myFactionViews += 1;
    if (r.event_name === "page.free_agents_view") agg.freeAgentsViews += 1;
    if (r.event_name === "page.league_leaders_view") agg.leadersViews += 1;
    if (r.event_name === "page.logged_in_view") agg.loggedInViews += 1;
    if (r.event_name === "session.logged_in_start") agg.sessionStarts += 1;
  }
  for (const r of contentRows) {
    if (!r.user_id) continue;
    const agg = ensureUserAgg(r.user_id);
    agg.total += 1;
    if (!agg.lastSeen || r.occurred_at > agg.lastSeen) agg.lastSeen = r.occurred_at;
    if (r.event_name === "page.news_article_view") agg.articleViews += 1;
    if (r.event_name === "page.event_results_view") agg.resultsViews += 1;
  }

  const userRows = Array.from(userAggMap.values());
  const noEngagementCount = userRows.filter((u) => u.total === 0).length;
  const engagedCount = userRows.length - noEngagementCount;

  const sortValue = (u: UserAgg): string | number => {
    switch (sortKey) {
      case "name":
        return (u.displayName ?? u.email ?? "").toLowerCase();
      case "signIns":
        return u.signIns;
      case "faAdds":
        return u.faAdds;
      case "drops":
        return u.drops;
      case "tradesExecuted":
        return u.tradesExecuted;
      case "loggedInViews":
        return u.loggedInViews;
      case "articleViews":
        return u.articleViews;
      case "resultsViews":
        return u.resultsViews;
      case "lastSeen":
        return u.lastSeen ?? "";
      default:
        return u.total;
    }
  };
  userRows.sort((a, b) => {
    const av = sortValue(a);
    const bv = sortValue(b);
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  function sortHref(nextSort: string) {
    const nextDir = sortKey === nextSort && sortDir === "desc" ? "asc" : "desc";
    const q = new URLSearchParams();
    if (season) q.set("season", season);
    q.set("sort", nextSort);
    q.set("dir", nextDir);
    return `/internal-admin/engagement?${q.toString()}`;
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <p style={{ marginBottom: 12 }}>
        <Link href="/internal-admin" className="app-link">
          ← Site admin
        </Link>
      </p>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Season engagement</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
        Logged-in behavior and in-league action tracking for the selected season. Article and Results headline totals
        count all logged-in views (not scoped to the season). Daily trend uses exact per-day counts (not capped by the
        newest 50k events). The per-user table loads season events from the last {USER_TABLE_LOOKBACK_DAYS} days (large
        leagues may hit a row cap — totals above still use full database counts).
      </p>

      <form method="get" style={{ marginBottom: 18, display: "flex", gap: 10, alignItems: "center" }}>
        <label htmlFor="season" style={{ fontWeight: 600 }}>
          Season
        </label>
        <select id="season" name="season" defaultValue={season} className="app-input" style={{ maxWidth: 320 }}>
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="app-button">
          View
        </button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 18 }}>
        {[
          ["Sign-ins", `${kpi.signIns} (${kpi.signInsUnique} users)`],
          ["FA adds", String(kpi.faAdds)],
          ["Drops", String(kpi.drops)],
          ["Trades proposed", String(kpi.tradesProposed)],
          ["Trades executed", String(kpi.tradesExecuted)],
          ["My Faction views", String(kpi.myFactionViews)],
          ["Free Agents views", String(kpi.freeAgentsViews)],
          ["League Leaders views", String(kpi.leadersViews)],
          [
            "Article views",
            `${kpi.articleViews} (${kpi.articleViewsUnique} users)`,
          ],
          [
            "Results views",
            `${kpi.resultsViews} (${kpi.resultsViewsUnique} users)`,
          ],
          ["Logged-in page views", String(kpi.loggedInViews)],
          ["Logged-in sessions", String(kpi.sessionStarts)],
          ["DAU / WAU / MAU", `${kpi.dau} / ${kpi.wau} / ${kpi.mau}`],
          ["Season members", String(seasonUserIds.length)],
          ["Engaged users", String(engagedCount)],
          ["No engagement", String(noEngagementCount)],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: "12px 14px",
              background: "var(--color-bg-card)",
            }}
          >
            <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{label}</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      <section
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: "12px 14px",
          background: "var(--color-bg-card)",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Daily trend (latest 21 days with activity)</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>Date</th>
                <th style={{ padding: "8px 6px" }}>Sign-ins</th>
                <th style={{ padding: "8px 6px" }}>FA adds</th>
                <th style={{ padding: "8px 6px" }}>Drops</th>
                <th style={{ padding: "8px 6px" }}>Trades executed</th>
                <th style={{ padding: "8px 6px" }}>Logged-in page views</th>
                <th style={{ padding: "8px 6px" }}>Article views</th>
                <th style={{ padding: "8px 6px" }}>Results views</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((r) => (
                <tr key={r.day} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "8px 6px", fontFamily: "monospace" }}>{r.day}</td>
                  <td style={{ padding: "8px 6px" }}>{r.signIns}</td>
                  <td style={{ padding: "8px 6px" }}>{r.faAdds}</td>
                  <td style={{ padding: "8px 6px" }}>{r.drops}</td>
                  <td style={{ padding: "8px 6px" }}>{r.tradesExecuted}</td>
                  <td style={{ padding: "8px 6px" }}>{r.loggedInViews}</td>
                  <td style={{ padding: "8px 6px" }}>{r.articleViews}</td>
                  <td style={{ padding: "8px 6px" }}>{r.resultsViews}</td>
                </tr>
              ))}
              {dailyRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "12px 6px", color: "var(--color-text-muted)" }}>
                    No engagement events recorded for this season yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: "12px 14px",
          background: "var(--color-bg-card)",
          marginTop: 16,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>User engagement (season members)</h2>
        <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 12, fontSize: 13 }}>
          Sort by clicking column headers. Includes users in this season&apos;s leagues even if they have zero events.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}><Link className="app-link" href={sortHref("name")}>User</Link></th>
                <th style={{ padding: "8px 6px" }}><Link className="app-link" href={sortHref("total")}>Total events</Link></th>
                <th style={{ padding: "8px 6px" }}><Link className="app-link" href={sortHref("signIns")}>Sign-ins</Link></th>
                <th style={{ padding: "8px 6px" }}><Link className="app-link" href={sortHref("faAdds")}>FA adds</Link></th>
                <th style={{ padding: "8px 6px" }}><Link className="app-link" href={sortHref("drops")}>Drops</Link></th>
                <th style={{ padding: "8px 6px" }}><Link className="app-link" href={sortHref("tradesExecuted")}>Trades executed</Link></th>
                <th style={{ padding: "8px 6px" }}><Link className="app-link" href={sortHref("loggedInViews")}>Logged-in views</Link></th>
                <th style={{ padding: "8px 6px" }}><Link className="app-link" href={sortHref("articleViews")}>Articles</Link></th>
                <th style={{ padding: "8px 6px" }}><Link className="app-link" href={sortHref("resultsViews")}>Results</Link></th>
                <th style={{ padding: "8px 6px" }}><Link className="app-link" href={sortHref("lastSeen")}>Last seen</Link></th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((u) => (
                <tr key={u.userId} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "8px 6px" }}>
                    <div style={{ fontWeight: 600 }}>
                      {u.displayName?.trim() || u.email?.trim() || "User"}
                    </div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                      {u.email?.trim() || "No email found"}
                    </div>
                    <div style={{ color: "var(--color-text-muted)", fontFamily: "monospace", fontSize: 12 }}>
                      {u.userId}
                    </div>
                  </td>
                  <td style={{ padding: "8px 6px", fontWeight: 600 }}>{u.total}</td>
                  <td style={{ padding: "8px 6px" }}>{u.signIns}</td>
                  <td style={{ padding: "8px 6px" }}>{u.faAdds}</td>
                  <td style={{ padding: "8px 6px" }}>{u.drops}</td>
                  <td style={{ padding: "8px 6px" }}>{u.tradesExecuted}</td>
                  <td style={{ padding: "8px 6px" }}>{u.loggedInViews}</td>
                  <td style={{ padding: "8px 6px" }}>{u.articleViews}</td>
                  <td style={{ padding: "8px 6px" }}>{u.resultsViews}</td>
                  <td style={{ padding: "8px 6px", color: "var(--color-text-muted)" }}>
                    {u.lastSeen ? `${u.lastSeen.slice(0, 10)} ${u.lastSeen.slice(11, 16)}Z` : "—"}
                  </td>
                </tr>
              ))}
              {userRows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: "12px 6px", color: "var(--color-text-muted)" }}>
                    No season members found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
