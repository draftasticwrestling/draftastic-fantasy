import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueBySlug,
  getLeagueMembers,
  getRostersForLeague,
  getLeagueScoring,
} from "@/lib/leagues";
import { getPointsByOwnerForLeagueWithBonuses } from "@/lib/leagueMatchups";
import {
  getNextUpcomingEvent,
  getLineupForEvent,
  getTradeProposalsForLeague,
  getReleaseProposalsForLeague,
  getFreeAgentProposalsForLeague,
} from "@/lib/leagueOwner";
import { getRosterRulesForLeague, getActivePerEvent } from "@/lib/leagueStructure";
import { LineupForm } from "../LineupForm";
import { ProposeTradeForm } from "../ProposeTradeForm";
import { ProposeReleaseForm } from "../ProposeReleaseForm";
import { ProposeFreeAgentForm } from "../ProposeFreeAgentForm";
import { TradeProposalRespond } from "../TradeProposalRespond";
import { EditTeamNameForm } from "../EditTeamNameForm";
import { RosterTable } from "../../RosterTable";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; userId: string }>;
  searchParams?: Promise<{ proposeTradeTo?: string }>;
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
    (await supabase.from("wrestlers").select("id, name").order("name", { ascending: true })).data ??
    [];
  const wrestlerNamesMap = Object.fromEntries(wrestlers.map((w) => [w.id, w.name ?? w.id]));
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
          />
        </section>
      </main>
    );
  }

  const rosterRules = getRosterRulesForLeague(members.length);
  const activePerEvent = rosterRules ? getActivePerEvent(rosterRules.rosterSize) : undefined;
  const rosterWrestlers = rosterEntries.map((e) => {
    const w = wrestlers.find((x) => x.id === e.wrestler_id);
    return { id: e.wrestler_id, name: w?.name ?? e.wrestler_id };
  });
  const draftedIds = new Set<string>();
  for (const entries of Object.values(rosters)) for (const e of entries) draftedIds.add(e.wrestler_id);
  const freeAgents = wrestlers.filter((w) => !draftedIds.has(w.id));
  const otherMembers = members.filter((m) => m.user_id !== currentUser.id);
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));

  let nextEvent: Awaited<ReturnType<typeof getNextUpcomingEvent>> = null;
  let lineupIds: string[] = [];
  let tradeProposals: Awaited<ReturnType<typeof getTradeProposalsForLeague>> = [];
  let releaseProposals: Awaited<ReturnType<typeof getReleaseProposalsForLeague>> = [];
  let faProposals: Awaited<ReturnType<typeof getFreeAgentProposalsForLeague>> = [];
  try {
    [nextEvent, tradeProposals, releaseProposals, faProposals] = await Promise.all([
      getNextUpcomingEvent({ preferSmackDown: true }),
      getTradeProposalsForLeague(league.id),
      getReleaseProposalsForLeague(league.id),
      getFreeAgentProposalsForLeague(league.id),
    ]);
  } catch {
    // Tables may not exist
  }
  if (nextEvent) {
    try {
      lineupIds = await getLineupForEvent(league.id, currentUser.id, nextEvent.id);
    } catch {
      lineupIds = [];
    }
  }
  const tradesForMe = tradeProposals.filter(
    (p) => p.status === "pending" && p.to_user_id === currentUser.id
  );

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
        Manage your roster, set your lineup for the next event, and propose trades, releases, or free agent signings.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>My roster</h2>
        {rosterRules && (
          <p style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
            {rosterEntries.length} / {rosterRules.rosterSize} wrestlers (min {rosterRules.minFemale} female, min {rosterRules.minMale} male).
          </p>
        )}
        <RosterTable
          entries={rosterEntries}
          wrestlerName={(id) => wrestlerNamesMap[id] ?? id}
          leagueSlug={slug}
          pointsByWrestlerId={Object.fromEntries(rosterWithPoints.map((w) => [w.wrestler_id, w.points]))}
          maxSlots={rosterRules?.rosterSize}
        />
      </section>

      {nextEvent && activePerEvent != null && rosterWrestlers.length > 0 && (
        <section
          style={{
            marginBottom: 32,
            padding: 16,
            background: "#f8f9fa",
            borderRadius: 8,
            border: "1px solid #eee",
          }}
        >
          <LineupForm
            leagueSlug={slug}
            eventId={nextEvent.id}
            eventName={nextEvent.name}
            roster={rosterWrestlers}
            initialActiveIds={lineupIds}
            maxActive={activePerEvent}
          />
        </section>
      )}
      {!nextEvent && (
        <p style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>
          No upcoming event found. Lineup will be available when the next event is scheduled.
        </p>
      )}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Propose trade</h2>
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

      <section style={{ marginBottom: 32 }}>
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
