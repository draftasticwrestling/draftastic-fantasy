import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { factionDisplayName } from "@/lib/factionName";
import { formatRecipientRosterCutsLine } from "@/lib/tradeDisplay";

export type TradeEmailContext = {
  proposalId: string;
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  commissionerId: string | null;
  fromUserId: string;
  toUserId: string;
  fromFactionName: string;
  toFactionName: string;
  proposerGives: string[];
  proposerReceives: string[];
  recipientCutsLine: string | null;
};

export async function loadTradeEmailContext(
  proposalId: string
): Promise<TradeEmailContext | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const { data: proposal, error: propErr } = await admin
    .from("league_trade_proposals")
    .select("id, league_id, from_user_id, to_user_id, to_user_drop_ids")
    .eq("id", proposalId)
    .maybeSingle();
  if (propErr || !proposal) {
    if (propErr) console.warn("[email] trade proposal load:", propErr.message);
    return null;
  }

  const { data: league } = await admin
    .from("leagues")
    .select("name, slug, commissioner_id")
    .eq("id", proposal.league_id)
    .maybeSingle();
  if (!league?.slug) return null;

  const [{ data: items }, { data: members }, { data: profiles }] = await Promise.all([
    admin
      .from("league_trade_proposal_items")
      .select("wrestler_id, direction")
      .eq("proposal_id", proposalId),
    admin
      .from("league_members")
      .select("user_id, team_name")
      .eq("league_id", proposal.league_id)
      .in("user_id", [proposal.from_user_id, proposal.to_user_id]),
    admin
      .from("profiles")
      .select("id, display_name")
      .in("id", [proposal.from_user_id, proposal.to_user_id]),
  ]);

  const profileById = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p as { display_name: string | null }])
  );
  const memberByUserId = Object.fromEntries(
    (members ?? []).map((m) => [
      (m as { user_id: string }).user_id,
      m as { team_name: string | null },
    ])
  );

  function memberLabel(userId: string): string {
    const prof = profileById[userId];
    const mem = memberByUserId[userId];
    return factionDisplayName(
      {
        team_name: mem?.team_name ?? null,
        display_name: prof?.display_name ?? null,
      },
      "Unknown"
    );
  }

  const wrestlerIds = [...new Set((items ?? []).map((i) => (i as { wrestler_id: string }).wrestler_id))];
  const { data: wrestlers } = wrestlerIds.length
    ? await admin.from("wrestlers").select("id, name").in("id", wrestlerIds)
    : { data: [] as { id: string; name: string | null }[] };
  const wrestlerNames: Record<string, string> = Object.fromEntries(
    (wrestlers ?? []).map((w) => [w.id, w.name ?? w.id])
  );

  const giveIds = (items ?? [])
    .filter((i) => (i as { direction: string }).direction === "give")
    .map((i) => (i as { wrestler_id: string }).wrestler_id);
  const receiveIds = (items ?? [])
    .filter((i) => (i as { direction: string }).direction === "receive")
    .map((i) => (i as { wrestler_id: string }).wrestler_id);

  const dropIds = (
    ((proposal as { to_user_drop_ids?: string[] | null }).to_user_drop_ids ?? []) as string[]
  )
    .map((x) => String(x).trim())
    .filter(Boolean);
  const toName = memberLabel(proposal.to_user_id);
  const recipientCutsLine = formatRecipientRosterCutsLine(
    toName,
    dropIds.map((id) => wrestlerNames[id] ?? id)
  );

  return {
    proposalId,
    leagueId: proposal.league_id,
    leagueName: league.name ?? "Your league",
    leagueSlug: league.slug,
    commissionerId: league.commissioner_id ?? null,
    fromUserId: proposal.from_user_id,
    toUserId: proposal.to_user_id,
    fromFactionName: memberLabel(proposal.from_user_id),
    toFactionName: toName,
    proposerGives: giveIds.map((id) => wrestlerNames[id] ?? id),
    proposerReceives: receiveIds.map((id) => wrestlerNames[id] ?? id),
    recipientCutsLine,
  };
}

export function formatTradeBodyLine(ctx: TradeEmailContext): string {
  const gives = ctx.proposerGives.join(", ") || "—";
  const receives = ctx.proposerReceives.join(", ") || "—";
  let line = `${ctx.fromFactionName} offers ${gives} for ${receives} from ${ctx.toFactionName}.`;
  if (ctx.recipientCutsLine) line += ` ${ctx.recipientCutsLine}`;
  return line;
}
