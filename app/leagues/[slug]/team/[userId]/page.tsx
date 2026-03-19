import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueBySlug,
  getLeagueMembers,
  getRostersForLeague,
  getEffectiveLeagueStartDate,
} from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import { getTradeProposalsForLeague } from "@/lib/leagueOwner";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { ProposeTradeForm } from "../ProposeTradeForm";
import { ProposeReleaseForm } from "../ProposeReleaseForm";
import { ProposeFreeAgentForm } from "../ProposeFreeAgentForm";
import { TradeProposalRespond } from "../TradeProposalRespond";
import { CancelTradeButton } from "../CancelTradeButton";
import { RosterCardGrid } from "../RosterCardGrid";
import type { WrestlerRow } from "@/app/wrestlers/WrestlerList";
import { aggregateWrestlerPoints, getPointsForWrestler } from "@/lib/scoring/aggregateWrestlerPoints.js";
import { aggregateWrestlerMatchStats, getMatchStatsForWrestler } from "@/lib/scoring/aggregateWrestlerMatchStats.js";
import {
  computeEndOfMonthBeltPoints,
  getCurrentChampionsBySlug,
  getMonthlyBeltForWrestler,
  inferReignsFromEvents,
  mergeReigns,
} from "@/lib/scoring/endOfMonthBeltPoints.js";
import { normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { getPersonasForDisplay } from "@/lib/scoring/personaResolution.js";
import { getBeltImageUrlForTitle } from "@/lib/championshipBeltOverlay";
import type { CurrentChampionFromChanges } from "@/lib/championshipCurrentFromChanges";
import { getCurrentChampionsFromChanges } from "@/lib/championshipCurrentFromChanges";
import { getCurrentChampionsFromChampionshipsTable } from "@/lib/championshipCurrentFromTable";
import { getTeamScoringAudit } from "@/lib/teamScoring";

const ALL_TIME_EVENTS_FROM = "2020-01-01";
const ALL_TIME_EVENTS_LIMIT = 10000;

function firstMonthEndOnOrAfter(startDate: string): string {
  const d = new Date(startDate + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.toISOString().slice(0, 10);
}

function read2kRating(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

type ChampionshipReign = {
  champion_slug?: string | null;
  champion_id?: string | null;
  champion?: string | null;
  champion_name?: string | null;
  title?: string | null;
  title_name?: string | null;
  won_date?: string | null;
  start_date?: string | null;
  lost_date?: string | null;
  end_date?: string | null;
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; userId: string }>;
  searchParams?: Promise<{ proposeTradeTo?: string; addFa?: string }>;
};

export async function generateMetadata({ params }: Props) {
  try {
    const { slug, userId } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return { title: "Team — Draftastic Fantasy" };
    const members = await getLeagueMembers(league.id);
    const m = members.find((x) => x.user_id === userId);
    const name = m?.team_name?.trim() || m?.display_name?.trim() || "Team";
    return {
      title: `${name} — ${league.name} — Draftastic Fantasy`,
      description: `Roster and points for ${name}`,
    };
  } catch {
    return { title: "Team — Draftastic Fantasy" };
  }
}

export default async function TeamUserIdPage({ params, searchParams }: Props) {
  const { slug, userId } = await params;
  const sp = searchParams ? await searchParams : {};
  const proposeTradeTo = typeof sp.proposeTradeTo === "string" ? sp.proposeTradeTo.trim() : undefined;
  const addFa = typeof sp.addFa === "string" ? sp.addFa.trim() : undefined;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) notFound();

  const [members, rosters, pointsWithBonuses, teamScoringAudit] = await Promise.all([
    getLeagueMembers(league.id),
    getRostersForLeague(league.id),
    getPointsByOwnerForLeagueWithBonuses(league.id),
    getTeamScoringAudit(league.id, userId),
  ]);
  const isMember = members.some((m) => m.user_id === currentUser.id);
  if (!isMember) notFound();

  const targetMember = members.find((m) => m.user_id === userId);
  if (!targetMember) notFound();

  const isOwnTeam = currentUser.id === userId;
  const teamLabel =
    (targetMember.team_name?.trim() || targetMember.display_name?.trim() || "Unknown").trim() ||
    "Unknown";
  const rosterEntries = rosters[userId] ?? [];
  const totalPoints = pointsWithBonuses[userId] ?? 0;

  const wrestlers =
    (await supabase.from("wrestlers").select("id, name, image_url, gender").order("name", { ascending: true })).data ??
    [];
  const wrestlerNamesMap = Object.fromEntries(wrestlers.map((w) => [w.id, w.name ?? w.id]));
  const wrestlerImageUrl: Record<string, string | null> = Object.fromEntries(
    wrestlers.map((w) => [w.id, w.image_url ?? null])
  );
  const rosterAcquiredAtById: Record<string, string | null> = Object.fromEntries(
    teamScoringAudit.activeStints.map((s) => [s.wrestler_id, s.acquired_at ?? null])
  );

  const rosterRules = getRosterRulesForLeague(members.length);
  const rosterWrestlers = rosterEntries.map((e) => {
    const w = wrestlers.find((x) => x.id === e.wrestler_id) as { id: string; name: string | null; gender?: string | null } | undefined;
    return { id: e.wrestler_id, name: w?.name ?? e.wrestler_id, gender: w?.gender ?? null };
  });

  const rosterIds = rosterEntries.map((e) => e.wrestler_id);
  let rosterTableRows: WrestlerRow[] = [];
  if (rosterIds.length > 0) {
    const supabaseTable = await createClient();
    const startDate = getEffectiveLeagueStartDate(league);
    const [{ data: fullWrestlersData }, { data: eventsSinceStart }, { data: eventsAll }, { data: rawReigns }, currentFromTable, currentFromChanges] = await Promise.all([
      supabaseTable.from("wrestlers").select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"').in("id", rosterIds),
      supabaseTable.from("events").select("id, name, date, matches").eq("status", "completed").gte("date", startDate).order("date", { ascending: true }),
      supabaseTable.from("events").select("id, name, date, matches").eq("status", "completed").gte("date", ALL_TIME_EVENTS_FROM).order("date", { ascending: true }).limit(ALL_TIME_EVENTS_LIMIT),
      supabaseTable.from("championship_history").select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date").order("won_date", { ascending: true }),
      getCurrentChampionsFromChampionshipsTable(supabaseTable).catch((): Record<string, CurrentChampionFromChanges> => ({})),
      getCurrentChampionsFromChanges(supabaseTable).catch((): Record<string, CurrentChampionFromChanges> => ({})),
    ]);
    const fullWrestlers = fullWrestlersData ?? [];
    const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
    const inferredReigns = inferReignsFromEvents(eventsAll ?? []);
    const reigns = mergeReigns(tableReigns, inferredReigns) as ChampionshipReign[];
    const firstEligibleMonthEnd = firstMonthEndOnOrAfter(startDate);
    const pointsBySlugSinceStart = aggregateWrestlerPoints(eventsSinceStart ?? []);
    const pointsBySlugAllTime = aggregateWrestlerPoints(eventsAll ?? []);
    const matchStatsBySlugSinceStart = aggregateWrestlerMatchStats(eventsSinceStart ?? []);
    const matchStatsBySlugAllTime = aggregateWrestlerMatchStats(eventsAll ?? []);
    const endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, firstEligibleMonthEnd);
    const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);
    rosterTableRows = fullWrestlers.map((w: { id: string; name: string | null; gender: string | null; brand: string | null; image_url?: string | null; dob?: string | null; Status?: string | null; "2K26 rating"?: number | null; "2K25 rating"?: number | null }) => {
      const slugKey = w.id;
      const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
      const idKey = normalizeWrestlerName(String(w.id));
      const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
      const points = getPointsForWrestler(pointsBySlugSinceStart, slugKey, nameKey);
      const pointsAllTime = getPointsForWrestler(pointsBySlugAllTime, slugKey, nameKey);
      const matchStats = getMatchStatsForWrestler(matchStatsBySlugSinceStart, slugKey, nameKey);
      const matchStatsAllTime = getMatchStatsForWrestler(matchStatsBySlugAllTime, slugKey, nameKey);
      const extraBelt = getMonthlyBeltForWrestler(endOfMonthBeltPoints, slugKey, nameKey);
      const beltPoints = points.beltPoints + extraBelt;
      const totalPoints = points.rsPoints + points.plePoints + beltPoints;
      const beltPointsAllTime = pointsAllTime.beltPoints + extraBelt;
      const totalPointsAllTime = pointsAllTime.rsPoints + pointsAllTime.plePoints + beltPointsAllTime;
      const fromTable =
        currentFromTable[idKey] ?? currentFromTable[slugKey] ?? (nameKey ? currentFromTable[nameKey] : null);
      const fromChanges =
        currentFromChanges[idKey] ?? currentFromChanges[slugKey] ?? (nameKey ? currentFromChanges[nameKey] : null);
      const titlesFromHistory = currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[slugKey] ?? (nameKey ? currentChampionsBySlug[nameKey] : null) ?? [];
      const primaryTitle = (fromTable ?? fromChanges) ? (fromTable ?? fromChanges)!.title : (titlesFromHistory[0] ?? null);
      const titles = primaryTitle ? [primaryTitle] : titlesFromHistory;
      const raw = w as Record<string, unknown>;
      return {
        id: w.id,
        name: w.name ?? null,
        gender: w.gender ?? null,
        brand: w.brand ?? null,
        image_url: (w as { image_url?: string }).image_url ?? null,
        dob: (w as { dob?: string }).dob ?? null,
        rating_2k26: read2kRating(w as Record<string, unknown>, "2K26 rating"),
        rating_2k25: read2kRating(w as Record<string, unknown>, "2K25 rating"),
        rsPoints: points.rsPoints,
        plePoints: points.plePoints,
        beltPoints,
        totalPoints,
        rsPoints2025: 0,
        plePoints2025: 0,
        beltPoints2025: 0,
        totalPoints2025: 0,
        rsPoints2026: 0,
        plePoints2026: 0,
        beltPoints2026: 0,
        totalPoints2026: 0,
        rsPointsAllTime: pointsAllTime.rsPoints,
        plePointsAllTime: pointsAllTime.plePoints,
        beltPointsAllTime,
        totalPointsAllTime,
        mw: matchStats.mw,
        win: matchStats.win,
        loss: matchStats.loss,
        nc: matchStats.nc,
        dqw: matchStats.dqw,
        dql: matchStats.dql,
        mw2025: 0,
        win2025: 0,
        loss2025: 0,
        nc2025: 0,
        dqw2025: 0,
        dql2025: 0,
        mw2026: 0,
        win2026: 0,
        loss2026: 0,
        nc2026: 0,
        dqw2026: 0,
        dql2026: 0,
        mwAllTime: matchStatsAllTime.mw,
        winAllTime: matchStatsAllTime.win,
        lossAllTime: matchStatsAllTime.loss,
        ncAllTime: matchStatsAllTime.nc,
        dqwAllTime: matchStatsAllTime.dqw,
        dqlAllTime: matchStatsAllTime.dql,
        personaDisplay: getPersonasForDisplay(w.id) ?? null,
        status: (raw.Status ?? raw.status) != null ? String(raw.Status ?? raw.status) : null,
        currentChampionship: titles.length > 0 ? titles.join(", ") : null,
        championBeltImageUrl: titles.length > 0 ? getBeltImageUrlForTitle(titles[0], w.gender) : null,
      };
    });
  }

  const rosterByWrestlerForTable: Record<string, { ownerName: string; ownerUserId: string }> = {};
  if (rosterTableRows.length > 0) {
    for (const w of rosterTableRows) {
      rosterByWrestlerForTable[w.id] = { ownerName: targetMember.team_name?.trim() || targetMember.display_name?.trim() || "My team", ownerUserId: userId };
    }
  }

  const draftedIds = new Set<string>();
  for (const entries of Object.values(rosters)) for (const e of entries) draftedIds.add(e.wrestler_id);
  const freeAgents = wrestlers.filter((w) => !draftedIds.has(w.id));
  const otherMembers = members.filter((m) => m.user_id !== currentUser.id);
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));

  let tradeProposals: Awaited<ReturnType<typeof getTradeProposalsForLeague>> = [];
  try {
    tradeProposals = await getTradeProposalsForLeague(league.id);
  } catch {
    // Tables may not exist
  }
  const tradesForMe = tradeProposals.filter(
    (p) => p.status === "pending" && p.to_user_id === currentUser.id
  );

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 1200,
        margin: "0 auto",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href={`/leagues/${slug}`} style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← {league.name}
        </Link>
      </p>
      <h1
        style={{
          marginBottom: 6,
          fontSize: "2rem",
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        {teamLabel}
      </h1>
      <p
        style={{
          color: "#555",
          marginBottom: 12,
          fontSize: 18,
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "6px 16px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #c00 0%, #7a0000 100%)",
            color: "#fff",
            fontWeight: 800,
            letterSpacing: 0.5,
            fontSize: 20,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          }}
        >
          {totalPoints} pts
        </span>
      </p>
      <p style={{ marginTop: 0, marginBottom: 28, textAlign: "center" }}>
        <Link
          href={`/leagues/${slug}/team/${encodeURIComponent(userId)}/scoreboard`}
          style={{ color: "#1a73e8", textDecoration: "none", fontWeight: 700 }}
        >
          View Team Scoreboard
        </Link>
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 8 }}>
          {isOwnTeam ? "My roster" : "Roster"}
        </h2>
        {rosterRules && (
          <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            {rosterEntries.length} / {rosterRules.rosterSize} wrestlers (min {rosterRules.minFemale} female, min {rosterRules.minMale} male).
          </p>
        )}
        {rosterTableRows.length > 0 ? (
          <RosterCardGrid
            wrestlers={rosterTableRows.map((w) => ({
              id: w.id,
              name: w.name,
              brand: w.brand,
              acquiredAt: rosterAcquiredAtById[w.id] ?? null,
              rsPoints: teamScoringAudit.totalsByWrestler[w.id]?.rsPoints ?? 0,
              plePoints: teamScoringAudit.totalsByWrestler[w.id]?.plePoints ?? 0,
              beltPoints: teamScoringAudit.totalsByWrestler[w.id]?.beltPoints ?? 0,
              totalPoints: teamScoringAudit.totalsByWrestler[w.id]?.total ?? 0,
              mw: w.mw ?? 0,
              rating_2k26: w.rating_2k26,
              rating_2k25: w.rating_2k25,
              championBeltImageUrl: w.championBeltImageUrl,
              image_url: w.image_url,
            }))}
            leagueSlug={slug}
            teamUserId={userId}
            viewerUserId={currentUser.id}
            showDrop={isOwnTeam}
            showTrade
            isOwnTeam={isOwnTeam}
          />
        ) : (
          <p style={{ color: "#666", fontSize: 14 }}>
            {isOwnTeam
              ? "No wrestlers on your roster yet. Add wrestlers via the draft or free agent signings."
              : "This team has no wrestlers on the roster yet."}
          </p>
        )}
      </section>

      {teamScoringAudit.formerStints.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Former {teamLabel}</h2>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
            Past roster stints and points scored while on this team.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {teamScoringAudit.formerStints.map((stint) => (
              <li
                key={`${stint.wrestlerId}-${stint.acquiredAt}-${stint.releasedAt}`}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#1f2937" }}>
                    {wrestlerNamesMap[stint.wrestlerId] ?? stint.wrestlerId}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {stint.acquiredAt} - {stint.releasedAt}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: "#111827" }}>
                  {stint.points.total} pts
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOwnTeam && (
        <>
          <section id="propose-trade" style={{ marginBottom: 32, scrollMarginTop: 16 }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Propose trade</h2>
            {proposeTradeTo && (() => {
              const target = otherMembers.find((m) => m.user_id === proposeTradeTo);
              if (!target) return null;
              const name = target.team_name?.trim() || target.display_name?.trim() || "this manager";
              return (
                <p style={{ fontSize: 14, color: "var(--color-blue)", fontWeight: 600, marginBottom: 12 }}>
                  Propose a trade with {name} (selected below).
                </p>
              );
            })()}
            <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
              Offer wrestlers to another owner and request wrestlers in return. They can accept, decline, or counter. If both agree, the commissioner must approve the trade.
            </p>
            {otherMembers.length === 0 ? (
              <p style={{ color: "#666" }}>No other members in the league.</p>
            ) : (
              <ProposeTradeForm
                leagueSlug={slug}
                myRosterWrestlers={rosterWrestlers}
                otherMembers={otherMembers.map((m) => ({
                  id: m.user_id,
                  name: (m.team_name?.trim() || m.display_name?.trim()) ?? "Unknown",
                }))}
                otherRosters={Object.fromEntries(
                  otherMembers.map((m) => [
                    m.user_id,
                    (rosters[m.user_id] ?? []).map((e) => e.wrestler_id),
                  ])
                )}
                wrestlerNames={wrestlerNamesMap}
                initialToUserId={proposeTradeTo}
              />
            )}
          </section>

          <section id="request-release" style={{ marginBottom: 32, scrollMarginTop: 16 }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Drop wrestler</h2>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
              Drop a wrestler from your roster. Takes effect immediately (first come, first serve).
            </p>
            {rosterWrestlers.length === 0 ? (
              <p style={{ color: "#666" }}>Your roster is empty.</p>
            ) : (
              <ProposeReleaseForm
                leagueSlug={slug}
                rosterWrestlers={rosterWrestlers}
                rosterRules={rosterRules}
                freeAgents={freeAgents.map((w) => ({ id: w.id, name: w.name ?? w.id }))}
                pendingReleaseIds={[]}
              />
            )}
          </section>

          <section id="sign-free-agent" style={{ marginBottom: 32, scrollMarginTop: 16 }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Add free agent</h2>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
              Add a wrestler who isn’t on any roster. If your roster is full, drop one to make room. Takes effect immediately (first come, first serve).
            </p>
            {freeAgents.length === 0 ? (
              <p style={{ color: "#666" }}>No free agents available.</p>
            ) : (
              <ProposeFreeAgentForm
                leagueSlug={slug}
                freeAgents={freeAgents}
                myRosterWrestlers={rosterWrestlers}
                rosterSize={rosterRules?.rosterSize ?? 0}
                pendingFaIds={[]}
                initialWrestlerId={addFa}
              />
            )}
          </section>
        </>
      )}

      {tradesForMe.length > 0 && (
        <section
          style={{
            marginBottom: 32,
            padding: 16,
            borderRadius: 16,
            background: "linear-gradient(180deg, rgba(34,197,94,0.16) 0%, rgba(34,197,94,0.06) 100%)",
            border: "1px solid rgba(34,197,94,0.35)",
          }}
        >
          <h2
            style={{
              fontSize: "1.1rem",
              marginBottom: 12,
              color: "rgba(16,185,129,1)",
            }}
          >
            Trade proposals for you
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {tradesForMe.map((p) => (
              <li
                key={p.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span>
                  {memberByUserId[p.from_user_id]?.display_name?.trim() ?? "Unknown"} offers: you give{" "}
                  {p.items
                    .filter((i) => i.direction === "receive")
                    .map((i) => wrestlerNamesMap[i.wrestler_id] ?? i.wrestler_id)
                    .join(", ")}{" "}
                  and receive{" "}
                  {p.items
                    .filter((i) => i.direction === "give")
                    .map((i) => wrestlerNamesMap[i.wrestler_id] ?? i.wrestler_id)
                    .join(", ")}
                </span>
                {(() => {
                  const rosterRules = getRosterRulesForLeague(members.length);
                  const myRosterIds = (rosters[currentUser.id] ?? []).map((e) => e.wrestler_id);
                  const giveCount = p.items.filter((i) => i.direction === "give").length; // recipient receives
                  const receiveCount = p.items.filter((i) => i.direction === "receive").length; // recipient gives
                  const delta = giveCount - receiveCount;
                  const rosterSize = rosterRules?.rosterSize ?? myRosterIds.length;
                  const requiredDropCount = Math.max(0, myRosterIds.length + delta - rosterSize);
                  const outgoing = new Set(p.items.filter((i) => i.direction === "receive").map((i) => i.wrestler_id));
                  const dropChoices = myRosterIds
                    .filter((id) => !outgoing.has(id))
                    .map((id) => ({ id, name: wrestlerNamesMap[id] ?? id }));
                  return (
                    <TradeProposalRespond
                      leagueSlug={slug}
                      proposalId={p.id}
                      proposalFromUserId={p.from_user_id}
                      requiredDropCount={requiredDropCount}
                      dropChoices={dropChoices}
                    />
                  );
                })()}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOwnTeam && tradeProposals.filter((p) => p.from_user_id === currentUser.id).length > 0 && (
        <section>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Your trade proposals</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
            {tradeProposals
              .filter((p) => p.from_user_id === currentUser.id)
              .map((p) => (
                <li key={p.id} style={{ padding: "8px 0", color: "#666", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <span>
                    Trade to {memberByUserId[p.to_user_id]?.display_name ?? memberByUserId[p.to_user_id]?.team_name ?? "another owner"}:{" "}
                    {p.status === "pending" && "Pending"}
                    {p.status === "cancelled" && "Cancelled"}
                    {p.status === "expired" && "Expired"}
                    {p.status === "rejected" && "Cancelled"}
                    {p.status === "awaiting_gm_approval" && "Accepted — awaiting GM approval"}
                    {p.status === "gm_approved" && "Approved"}
                    {p.status === "gm_rejected" && "Rejected by GM"}
                    {p.status === "accepted" && "Completed"}
                    {!["pending", "cancelled", "expired", "rejected", "awaiting_gm_approval", "gm_approved", "gm_rejected", "accepted"].includes(p.status) && p.status}
                  </span>
                  {p.status === "pending" && (
                    <CancelTradeButton leagueSlug={slug} proposalId={p.id} />
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  );
}
