import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import {
  getNextUpcomingEvent,
  getLineupForEvent,
  getTradeProposalsForLeague,
  getReleaseProposalsForLeague,
  getFreeAgentProposalsForLeague,
} from "@/lib/leagueOwner";
import { getRosterRulesForLeague, getActivePerEvent } from "@/lib/leagueStructure";
import { LineupForm } from "./LineupForm";
import { ProposeTradeForm } from "./ProposeTradeForm";
import { ProposeReleaseForm } from "./ProposeReleaseForm";
import { ProposeFreeAgentForm } from "./ProposeFreeAgentForm";
import { TradeProposalRespond } from "./TradeProposalRespond";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  try {
    const { slug } = await params;
    const league = await getLeagueBySlug(slug);
    if (!league) return { title: "My team — Draftastic Fantasy" };
    return {
      title: `My team — ${league.name} — Draftastic Fantasy`,
      description: `Your roster, lineup, and proposals for ${league.name}`,
    };
  } catch {
    return { title: "My team — Draftastic Fantasy" };
  }
}

export default async function TeamPage({ params }: Props) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const members = await getLeagueMembers(league.id);
  const isMember = members.some((m) => m.user_id === user.id);
  if (!isMember) notFound();

  const rosters = await getRostersForLeague(league.id);
  const myRoster = rosters[user.id] ?? [];
  const rosterRules = getRosterRulesForLeague(members.length);
  const activePerEvent = rosterRules ? getActivePerEvent(rosterRules.rosterSize) : undefined;

  let nextEvent: Awaited<ReturnType<typeof getNextUpcomingEvent>> = null;
  let lineupIds: string[] = [];
  let wrestlers: { id: string; name: string | null }[] = [];
  let tradeProposals: Awaited<ReturnType<typeof getTradeProposalsForLeague>> = [];
  let releaseProposals: Awaited<ReturnType<typeof getReleaseProposalsForLeague>> = [];
  let faProposals: Awaited<ReturnType<typeof getFreeAgentProposalsForLeague>> = [];

  try {
    [nextEvent, wrestlers, tradeProposals, releaseProposals, faProposals] = await Promise.all([
      getNextUpcomingEvent({ preferSmackDown: true }),
      (async () => {
        const { data } = await supabase.from("wrestlers").select("id, name").order("name", { ascending: true });
        return (data ?? []) as { id: string; name: string | null }[];
      })(),
      getTradeProposalsForLeague(league.id),
      getReleaseProposalsForLeague(league.id),
      getFreeAgentProposalsForLeague(league.id),
    ]);
  } catch {
    // Tables may not exist yet
  }

  if (nextEvent) {
    try {
      lineupIds = await getLineupForEvent(league.id, user.id, nextEvent.id);
    } catch {
      lineupIds = [];
    }
  }

  const rosterWrestlers = myRoster.map((e) => {
    const w = wrestlers.find((x) => x.id === e.wrestler_id);
    return { id: e.wrestler_id, name: w?.name ?? e.wrestler_id };
  });
  const draftedIds = new Set<string>();
  for (const entries of Object.values(rosters)) for (const e of entries) draftedIds.add(e.wrestler_id);
  const freeAgents = wrestlers.filter((w) => !draftedIds.has(w.id));
  const otherMembers = members.filter((m) => m.user_id !== user.id);
  const wrestlerNamesMap = Object.fromEntries(wrestlers.map((w) => [w.id, w.name ?? w.id]));
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const tradesForMe = tradeProposals.filter((p) => p.status === "pending" && p.to_user_id === user.id);

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
      <p style={{ color: "#555", marginBottom: 24 }}>
        Manage your roster, set your lineup for the next event, and propose trades, releases, or free agent signings.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>My roster</h2>
        {rosterRules && (
          <p style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
            {myRoster.length} / {rosterRules.rosterSize} wrestlers (min {rosterRules.minFemale} female, min {rosterRules.minMale} male).
          </p>
        )}
        {myRoster.length === 0 ? (
          <p style={{ color: "#666" }}>No wrestlers on your roster yet. Join the draft or ask the commissioner to add you.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {rosterWrestlers.map((w) => (
              <li key={w.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                {w.name ?? w.id}
              </li>
            ))}
          </ul>
        )}
      </section>

      {nextEvent && activePerEvent != null && rosterWrestlers.length > 0 && (
        <section style={{ marginBottom: 32, padding: 16, background: "#f8f9fa", borderRadius: 8, border: "1px solid #eee" }}>
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
            otherMembers={otherMembers.map((m) => ({ id: m.user_id, name: m.display_name?.trim() ?? "Unknown" }))}
            otherRosters={Object.fromEntries(
              otherMembers.map((m) => [m.user_id, (rosters[m.user_id] ?? []).map((e) => e.wrestler_id)])
            )}
            wrestlerNames={wrestlerNamesMap}
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
          <ProposeReleaseForm leagueSlug={slug} rosterWrestlers={rosterWrestlers} pendingReleaseIds={releaseProposals.filter((p) => p.status === "pending" && p.user_id === user.id).map((p) => p.wrestler_id)} />
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
            pendingFaIds={faProposals.filter((p) => p.status === "pending" && p.user_id === user.id).map((p) => p.wrestler_id)}
          />
        )}
      </section>

      {tradesForMe.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Trade proposals for you</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {tradesForMe.map((p) => (
              <li key={p.id} style={{ padding: "12px 0", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span>
                  {memberByUserId[p.from_user_id]?.display_name?.trim() ?? "Unknown"} offers: you give{" "}
                  {p.items.filter((i) => i.direction === "receive").map((i) => wrestlerNamesMap[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                  {" "}and receive{" "}
                  {p.items.filter((i) => i.direction === "give").map((i) => wrestlerNamesMap[i.wrestler_id] ?? i.wrestler_id).join(", ")}
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
            {tradeProposals.filter((p) => p.from_user_id === user.id).map((p) => (
              <li key={p.id} style={{ padding: "6px 0", color: "#666" }}>
                Trade to another owner: {p.status}
              </li>
            ))}
            {releaseProposals.filter((p) => p.user_id === user.id).map((p) => (
              <li key={p.id} style={{ padding: "6px 0", color: "#666" }}>
                Release: {p.status}
              </li>
            ))}
            {faProposals.filter((p) => p.user_id === user.id).map((p) => (
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
