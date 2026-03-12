import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueBySlug,
  getLeagueMembers,
  getRostersForLeague,
  getLeagueScoring,
  getEffectiveLeagueStartDate,
} from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import {
  getTradeProposalsForLeague,
  getReleaseProposalsForLeague,
  getFreeAgentProposalsForLeague,
} from "@/lib/leagueOwner";
import { getRosterRulesForLeague } from "@/lib/leagueStructure";
import { ProposeTradeForm } from "../ProposeTradeForm";
import { ProposeReleaseForm } from "../ProposeReleaseForm";
import { ProposeFreeAgentForm } from "../ProposeFreeAgentForm";
import { TradeProposalRespond } from "../TradeProposalRespond";
import { EditTeamNameForm } from "../EditTeamNameForm";
import { RosterTable } from "../../RosterTable";
import WrestlerList, { type WrestlerRow } from "@/app/wrestlers/WrestlerList";
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

  const [members, rosters, scoring, pointsWithBonuses] = await Promise.all([
    getLeagueMembers(league.id),
    getRostersForLeague(league.id),
    getLeagueScoring(league.id),
    getPointsByOwnerForLeagueWithBonuses(league.id),
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
  const pointsBySlug = scoring.pointsBySlug;
  const pointsByOwnerByWrestler = scoring.pointsByOwnerByWrestler ?? {};
  const totalPoints = pointsWithBonuses[userId] ?? 0;

  const wrestlers =
    (await supabase.from("wrestlers").select("id, name, image_url").order("name", { ascending: true })).data ??
    [];
  const wrestlerNamesMap = Object.fromEntries(wrestlers.map((w) => [w.id, w.name ?? w.id]));
  const wrestlerImageUrl: Record<string, string | null> = Object.fromEntries(
    wrestlers.map((w) => [w.id, w.image_url ?? null])
  );
  const ownerWrestlerPts = pointsByOwnerByWrestler[userId];
  const rosterWithPoints = rosterEntries.map((e) => {
    const p = pointsBySlug[e.wrestler_id] ?? { rsPoints: 0, plePoints: 0, beltPoints: 0 };
    const fullSeason = p.rsPoints + p.plePoints + p.beltPoints;
    const wrestlerTotal = ownerWrestlerPts?.[e.wrestler_id] ?? fullSeason;
    return {
      wrestler_id: e.wrestler_id,
      name: wrestlerNamesMap[e.wrestler_id] ?? e.wrestler_id,
      points: wrestlerTotal,
    };
  });

  if (!isOwnTeam) {
    return (
      <main
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          maxWidth: 640,
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
        <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>{teamLabel}</h1>
        <p style={{ color: "#555", marginBottom: 24 }}>
          <span style={{ fontWeight: 600, color: "#c00" }}>{totalPoints} pts</span> total
        </p>
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Roster</h2>
          <RosterTable
            entries={rosterEntries}
            wrestlerName={(id) => wrestlerNamesMap[id] ?? id}
            leagueSlug={slug}
            pointsByWrestlerId={Object.fromEntries(rosterWithPoints.map((w) => [w.wrestler_id, w.points]))}
            wrestlerImageUrl={wrestlerImageUrl}
            showTradeButton
            tradeTargetUserId={userId}
          />
        </section>
      </main>
    );
  }

  const rosterRules = getRosterRulesForLeague(members.length);
  const rosterWrestlers = rosterEntries.map((e) => {
    const w = wrestlers.find((x) => x.id === e.wrestler_id);
    return { id: e.wrestler_id, name: w?.name ?? e.wrestler_id };
  });

  const rosterIds = rosterEntries.map((e) => e.wrestler_id);
  let rosterTableRows: WrestlerRow[] = [];
  if (isOwnTeam && rosterIds.length > 0) {
    const supabaseTable = await createClient();
    const [{ data: fullWrestlersData }, { data: eventsAll }, { data: rawReigns }] = await Promise.all([
      supabaseTable.from("wrestlers").select('id, name, gender, brand, image_url, dob, "Status", "2K26 rating", "2K25 rating"').in("id", rosterIds),
      supabaseTable.from("events").select("id, name, date, matches").eq("status", "completed").gte("date", ALL_TIME_EVENTS_FROM).order("date", { ascending: true }).limit(ALL_TIME_EVENTS_LIMIT),
      supabaseTable.from("championship_history").select("champion_slug, champion_id, champion, champion_name, title, title_name, won_date, start_date, lost_date, end_date").order("won_date", { ascending: true }),
    ]);
    const fullWrestlers = fullWrestlersData ?? [];
    const startDate = getEffectiveLeagueStartDate(league);
    const tableReigns = (rawReigns ?? []) as ChampionshipReign[];
    const inferredReigns = inferReignsFromEvents(eventsAll ?? []);
    const reigns = mergeReigns(tableReigns, inferredReigns) as ChampionshipReign[];
    const firstEligibleMonthEnd = firstMonthEndOnOrAfter(startDate);
    const pointsBySlug = aggregateWrestlerPoints(eventsAll ?? []);
    const matchStatsBySlug = aggregateWrestlerMatchStats(eventsAll ?? []);
    const endOfMonthBeltPoints = computeEndOfMonthBeltPoints(reigns, firstEligibleMonthEnd);
    const currentChampionsBySlug = getCurrentChampionsBySlug(reigns);
    rosterTableRows = fullWrestlers.map((w: { id: string; name: string | null; gender: string | null; brand: string | null; image_url?: string | null; dob?: string | null; Status?: string | null; "2K26 rating"?: number | null; "2K25 rating"?: number | null }) => {
      const slugKey = w.id;
      const nameKey = w.name ? normalizeWrestlerName(w.name) : "";
      const canonicalKey = nameKey || (slugKey ? normalizeWrestlerName(String(slugKey)) : "") || slugKey;
      const points = getPointsForWrestler(pointsBySlug, slugKey, nameKey);
      const matchStats = getMatchStatsForWrestler(matchStatsBySlug, slugKey, nameKey);
      const extraBelt = getMonthlyBeltForWrestler(endOfMonthBeltPoints, slugKey, nameKey);
      const beltPoints = points.beltPoints + extraBelt;
      const totalPoints = points.rsPoints + points.plePoints + beltPoints;
      const titles = currentChampionsBySlug[canonicalKey] ?? currentChampionsBySlug[slugKey] ?? (nameKey ? currentChampionsBySlug[nameKey] : null) ?? [];
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
        rsPointsAllTime: points.rsPoints,
        plePointsAllTime: points.plePoints,
        beltPointsAllTime: beltPoints,
        totalPointsAllTime: totalPoints,
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
        mwAllTime: matchStats.mw,
        winAllTime: matchStats.win,
        lossAllTime: matchStats.loss,
        ncAllTime: matchStats.nc,
        dqwAllTime: matchStats.dqw,
        dqlAllTime: matchStats.dql,
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
  let releaseProposals: Awaited<ReturnType<typeof getReleaseProposalsForLeague>> = [];
  let faProposals: Awaited<ReturnType<typeof getFreeAgentProposalsForLeague>> = [];
  try {
    [tradeProposals, releaseProposals, faProposals] = await Promise.all([
      getTradeProposalsForLeague(league.id),
      getReleaseProposalsForLeague(league.id),
      getFreeAgentProposalsForLeague(league.id),
    ]);
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
      <h1 style={{ marginBottom: 8, fontSize: "1.5rem" }}>My team</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Total: <strong style={{ color: "#c00" }}>{totalPoints} pts</strong>
      </p>
      <EditTeamNameForm
        key={targetMember.team_name ?? "default"}
        leagueSlug={slug}
        initialTeamName={targetMember.team_name ?? ""}
      />
      <p style={{ color: "#555", marginBottom: 24, fontSize: 14 }}>
        Manage your roster and propose trades, releases, or free agent signings.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 8 }}>My roster</h2>
        {rosterRules && (
          <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
            {rosterEntries.length} / {rosterRules.rosterSize} wrestlers (min {rosterRules.minFemale} female, min {rosterRules.minMale} male).
          </p>
        )}
        {rosterTableRows.length > 0 ? (
          <WrestlerList
            wrestlers={rosterTableRows}
            defaultSortColumn="totalPoints"
            defaultSortDir="desc"
            defaultPointsPeriod="sinceStart"
            leagueSlug={slug}
            wrestlerProfileFrom="team"
            rosterByWrestler={rosterByWrestlerForTable}
            hideRosterFilter
          />
        ) : (
          <p style={{ color: "#666", fontSize: 14 }}>No wrestlers on your roster yet. Add wrestlers via the draft or free agent signings.</p>
        )}
      </section>

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
          Offer wrestlers to another owner and request wrestlers in return. They can accept or reject.
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

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Request release</h2>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
          Request to drop a wrestler from your roster. The commissioner must approve.
        </p>
        {rosterWrestlers.length === 0 ? (
          <p style={{ color: "#666" }}>Your roster is empty.</p>
        ) : (
          <ProposeReleaseForm
            leagueSlug={slug}
            rosterWrestlers={rosterWrestlers}
            pendingReleaseIds={releaseProposals
              .filter((p) => p.status === "pending" && p.user_id === currentUser.id)
              .map((p) => p.wrestler_id)}
          />
        )}
      </section>

      <section id="sign-free-agent" style={{ marginBottom: 32, scrollMarginTop: 16 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Sign free agent</h2>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
          Request to add a wrestler who isn’t on any roster. Optionally drop one to make room. Commissioner must approve.
        </p>
        {freeAgents.length === 0 ? (
          <p style={{ color: "#666" }}>No free agents available.</p>
        ) : (
          <ProposeFreeAgentForm
            leagueSlug={slug}
            freeAgents={freeAgents}
            myRosterWrestlers={rosterWrestlers}
            rosterSize={rosterRules?.rosterSize ?? 0}
            pendingFaIds={faProposals
              .filter((p) => p.status === "pending" && p.user_id === currentUser.id)
              .map((p) => p.wrestler_id)}
            initialWrestlerId={addFa}
          />
        )}
      </section>

      {tradesForMe.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Trade proposals for you</h2>
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
                <TradeProposalRespond leagueSlug={slug} proposalId={p.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(tradeProposals.length > 0 || releaseProposals.length > 0 || faProposals.length > 0) && (
        <section>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Your proposals</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
            {tradeProposals
              .filter((p) => p.from_user_id === currentUser.id)
              .map((p) => (
                <li key={p.id} style={{ padding: "6px 0", color: "#666" }}>
                  Trade to another owner: {p.status}
                </li>
              ))}
            {releaseProposals
              .filter((p) => p.user_id === currentUser.id)
              .map((p) => (
                <li key={p.id} style={{ padding: "6px 0", color: "#666" }}>
                  Release: {p.status}
                </li>
              ))}
            {faProposals
              .filter((p) => p.user_id === currentUser.id)
              .map((p) => (
                <li key={p.id} style={{ padding: "6px 0", color: "#666" }}>
                  Free agent signing: {p.status}
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  );
}
