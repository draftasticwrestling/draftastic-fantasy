import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/serverAuth";
import { factionDisplayName } from "@/lib/factionName";
import { getLeagueBySlug, getLeagueMembers, getRostersForLeague } from "@/lib/leagues";
import {
  getRosterRulesForLeague,
  leagueIncludesNxt,
  leagueUsesSalaryCap,
  SALARY_CAP_MAX_ROSTER_SIZE,
} from "@/lib/leagueStructure";
import { getSalaryCapWeeklyFaBudgetStatus } from "@/lib/salaryCapWeeklyLimits";
import { getTradeProposalsForLeague, getWrestlerIdsLockedByPendingTrades } from "@/lib/leagueOwner";
import { formatRecipientRosterCutsLine } from "@/lib/tradeDisplay";
import { ProposeTradeForm } from "../team/ProposeTradeForm";
import { ProposeReleaseForm } from "../team/ProposeReleaseForm";
import { ProposeFreeAgentForm } from "../team/ProposeFreeAgentForm";
import { SalaryCapFreeAgentPicker } from "../team/SalaryCapFreeAgentPicker";
import { SalaryCapWeeklyFaBudget } from "../team/SalaryCapWeeklyFaBudget";
import { TradeProposalRespond } from "../team/TradeProposalRespond";
import { CancelTradeButton } from "../team/CancelTradeButton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ proposeTradeTo?: string; addFa?: string; dropWrestlerId?: string }>;
};

export default async function FactionActionsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = (searchParams ? await searchParams : {}) ?? {};
  const proposeTradeTo = typeof sp.proposeTradeTo === "string" ? sp.proposeTradeTo.trim() : "";
  const addFa = typeof sp.addFa === "string" ? sp.addFa.trim() : "";
  const dropWrestlerId = typeof sp.dropWrestlerId === "string" ? sp.dropWrestlerId.trim() : "";

  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const { supabase, user } = await getServerAuth();
  if (!user) notFound();

  const [members, rosters] = await Promise.all([
    getLeagueMembers(league.id),
    getRostersForLeague(league.id),
  ]);
  const currentMember = members.find((m) => m.user_id === user.id);
  if (!currentMember) notFound();

  const rosterRules = getRosterRulesForLeague(
    members.length,
    league.season_slug ?? null,
    leagueIncludesNxt(league),
    league.league_type ?? null
  );
  const rosterEntries = rosters[user.id] ?? [];
  const myRosterIds = new Set(rosterEntries.map((e) => e.wrestler_id));

  const { data: wrestlersRows } = await supabase
    .from("wrestlers")
    .select("id, name, gender, image_url")
    .order("name", { ascending: true });
  const wrestlers = (wrestlersRows ?? []) as Array<{
    id: string;
    name: string | null;
    gender: string | null;
    image_url?: string | null;
  }>;

  const wrestlerNamesMap = Object.fromEntries(
    wrestlers.map((w) => [w.id, w.name ?? w.id]),
  );
  const rosterWrestlers = rosterEntries.map((e) => {
    const wr = wrestlers.find((w) => w.id === e.wrestler_id);
    return {
      id: e.wrestler_id,
      name: wr?.name ?? e.wrestler_id,
      gender: wr?.gender ?? null,
    };
  });
  const isSalaryCapLeague = leagueUsesSalaryCap(league.league_type);
  const freeAgents = isSalaryCapLeague
    ? wrestlers.filter((w) => !myRosterIds.has(w.id))
    : wrestlers.filter((w) => !Object.values(rosters).some((entries) => entries.some((e) => e.wrestler_id === w.id)));

  const otherMembers = members.filter((m) => m.user_id !== user.id);
  const otherRosters = Object.fromEntries(
    otherMembers.map((m) => [m.user_id, (rosters[m.user_id] ?? []).map((e) => e.wrestler_id)]),
  );

  let tradeLockedWrestlerIds: string[] = [];
  try {
    tradeLockedWrestlerIds = await getWrestlerIdsLockedByPendingTrades(league.id, user.id);
  } catch {
    tradeLockedWrestlerIds = [];
  }

  const salaryCapWeeklyFaBudget = leagueUsesSalaryCap(league.league_type)
    ? await getSalaryCapWeeklyFaBudgetStatus(supabase, league.id, user.id)
    : null;

  let tradeProposals: Awaited<ReturnType<typeof getTradeProposalsForLeague>> = [];
  try {
    tradeProposals = await getTradeProposalsForLeague(league.id);
  } catch {
    tradeProposals = [];
  }
  const tradesForMe = tradeProposals.filter((p) => p.status === "pending" && p.to_user_id === user.id);
  const memberByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));

  return (
    <main className="app-page" style={{ paddingTop: 10, maxWidth: 760 }}>
      <p style={{ marginBottom: 14 }}>
        <Link href={`/leagues/${slug}/faction`} className="app-link">
          ← Faction
        </Link>
      </p>
      <h1 style={{ fontSize: "1.35rem", marginBottom: 12, color: "var(--color-text)" }}>Add / Drop / Trade</h1>

      {salaryCapWeeklyFaBudget ? <SalaryCapWeeklyFaBudget status={salaryCapWeeklyFaBudget} /> : null}

      <section id="propose-trade" style={{ marginBottom: 28, scrollMarginTop: 16 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 10 }}>Propose trade</h2>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
          Offer wrestlers to another manager and request wrestlers in return.
        </p>
        {otherMembers.length === 0 ? (
          <p style={{ color: "#666" }}>No other members in the league.</p>
        ) : (
          <ProposeTradeForm
            leagueSlug={slug}
            myRosterWrestlers={rosterWrestlers}
            otherMembers={otherMembers.map((m) => ({
              id: m.user_id,
              name: factionDisplayName(m, "Unknown"),
            }))}
            otherRosters={otherRosters}
            wrestlerNames={wrestlerNamesMap}
            initialToUserId={proposeTradeTo || undefined}
          />
        )}
      </section>

      <section id="request-release" style={{ marginBottom: 28, scrollMarginTop: 16 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 10 }}>Drop wrestler</h2>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
          Drop a wrestler from your roster. Takes effect immediately.
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
            initialWrestlerId={dropWrestlerId || undefined}
            tradeLockedWrestlerIds={tradeLockedWrestlerIds}
          />
        )}
      </section>

      <section id="sign-free-agent" style={{ marginBottom: 28, scrollMarginTop: 16 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 10 }}>Add free agent</h2>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
          {isSalaryCapLeague
            ? "Browse the free agent pool to sign wrestlers. Same stars can be on multiple factions."
            : "Add a wrestler who is not currently rostered."}
        </p>
        {isSalaryCapLeague ? (
          <SalaryCapFreeAgentPicker
            leagueSlug={slug}
            myRosterWrestlers={rosterWrestlers.map((w) => ({ id: w.id, name: w.name }))}
            rosterSize={rosterRules?.rosterSize ?? SALARY_CAP_MAX_ROSTER_SIZE}
            tradeLockedWrestlerIds={tradeLockedWrestlerIds}
            initialWrestlerId={addFa || undefined}
          />
        ) : freeAgents.length === 0 ? (
          <p style={{ color: "#666" }}>No free agents available.</p>
        ) : (
          <ProposeFreeAgentForm
            leagueSlug={slug}
            freeAgents={freeAgents.map((w) => ({ id: w.id, name: w.name }))}
            myRosterWrestlers={rosterWrestlers.map((w) => ({ id: w.id, name: w.name }))}
            rosterSize={rosterRules?.rosterSize ?? 0}
            pendingFaIds={[]}
            initialWrestlerId={addFa || undefined}
            tradeLockedWrestlerIds={tradeLockedWrestlerIds}
          />
        )}
      </section>

      {tradesForMe.length > 0 && (
        <section
          style={{
            marginBottom: 28,
            padding: 14,
            borderRadius: 14,
            background: "linear-gradient(180deg, rgba(34,197,94,0.16) 0%, rgba(34,197,94,0.06) 100%)",
            border: "1px solid rgba(34,197,94,0.35)",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12, color: "rgba(16,185,129,1)" }}>
            Trade proposals for you
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {tradesForMe.map((p) => {
              const giveCount = p.items.filter((i) => i.direction === "give").length;
              const receiveCount = p.items.filter((i) => i.direction === "receive").length;
              const delta = giveCount - receiveCount;
              const rosterSize = rosterRules?.rosterSize ?? myRosterIds.size;
              const requiredDropCount = Math.max(0, myRosterIds.size + delta - rosterSize);
              const outgoing = new Set(p.items.filter((i) => i.direction === "receive").map((i) => i.wrestler_id));
              const dropChoices = [...myRosterIds]
                .filter((id) => !outgoing.has(id))
                .map((id) => ({ id, name: wrestlerNamesMap[id] ?? id }));
              return (
                <li key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
                  <span style={{ display: "block", marginBottom: 8 }}>
                    {factionDisplayName(memberByUserId[p.from_user_id], "Unknown")} offers: you give{" "}
                    {p.items.filter((i) => i.direction === "receive").map((i) => wrestlerNamesMap[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                    {" "}and receive{" "}
                    {p.items.filter((i) => i.direction === "give").map((i) => wrestlerNamesMap[i.wrestler_id] ?? i.wrestler_id).join(", ")}
                  </span>
                  <TradeProposalRespond
                    leagueSlug={slug}
                    proposalId={p.id}
                    proposalFromUserId={p.from_user_id}
                    requiredDropCount={requiredDropCount}
                    dropChoices={dropChoices}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tradeProposals.filter((p) => p.from_user_id === user.id).length > 0 && (
        <section>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 10 }}>Your trade proposals</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
            {tradeProposals
              .filter((p) => p.from_user_id === user.id)
              .map((p) => (
                <li key={p.id} style={{ padding: "8px 0", color: "#666", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span>
                    Trade to {factionDisplayName(memberByUserId[p.to_user_id], "another manager")}: {p.status}
                    {(() => {
                      const dropIds = (p.to_user_drop_ids ?? []).map((x) => String(x).trim()).filter(Boolean);
                      if (dropIds.length === 0) return null;
                      const toName = factionDisplayName(memberByUserId[p.to_user_id], "Recipient");
                      const line = formatRecipientRosterCutsLine(
                        toName,
                        dropIds.map((id) => wrestlerNamesMap[id] ?? id),
                      );
                      return line ? <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#64748b" }}>{line}</span> : null;
                    })()}
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

