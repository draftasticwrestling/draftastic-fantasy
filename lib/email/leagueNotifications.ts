import "server-only";

import { emailButton, emailLayout, emailMutedLink } from "@/lib/email/layout";
import { resolveUserEmailTarget } from "@/lib/email/recipients";
import { escapeHtml, isEmailConfigured, sendTransactionalEmail } from "@/lib/email/sendEmail";
import {
  formatTradeBodyLine,
  loadTradeEmailContext,
  type TradeEmailContext,
} from "@/lib/email/tradeProposalSummary";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import { getAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/sitePublicOrigin";

function proposalsUrl(slug: string): string {
  return absoluteUrl(`/leagues/${slug}/proposals`);
}

async function sendToUser(
  userId: string,
  shouldSend: (prefs: import("@/lib/email/recipients").NotificationPrefs) => boolean,
  subject: string,
  bodyHtml: string,
  preheader?: string
): Promise<void> {
  if (!isEmailConfigured()) return;
  const target = await resolveUserEmailTarget(userId);
  if (!target || !shouldSend(target.prefs)) return;

  const html = emailLayout({ preheader, bodyHtml });
  const result = await sendTransactionalEmail({
    to: target.email,
    subject,
    html,
  });
  if (!result.ok) {
    console.warn("[email] send failed:", userId, result.error);
  }
}

function tradeParagraph(ctx: TradeEmailContext, extra?: string): string {
  const line = formatTradeBodyLine(ctx);
  const league = escapeHtml(ctx.leagueName);
  const extraBlock = extra ? `<p style="font-size:16px;line-height:1.5;">${extra}</p>` : "";
  return `
    <p style="font-size:16px;line-height:1.5;">In <strong>${league}</strong>:</p>
    <p style="font-size:16px;line-height:1.5;">${escapeHtml(line)}</p>
    ${extraBlock}`;
}

/** Recipient: new trade offer pending their response. */
export async function notifyTradeProposed(proposalId: string): Promise<void> {
  try {
    const ctx = await loadTradeEmailContext(proposalId);
    if (!ctx) return;
    const url = proposalsUrl(ctx.leagueSlug);
    const body = `
      <p style="font-size:16px;line-height:1.5;">Hi,</p>
      <p style="font-size:16px;line-height:1.5;"><strong>${escapeHtml(ctx.fromFactionName)}</strong> proposed a trade with you.</p>
      ${tradeParagraph(ctx)}
      ${emailButton(url, "Review trade")}
      ${emailMutedLink(url)}`;
    await sendToUser(
      ctx.toUserId,
      (p) => p.notify_trade_proposals,
      `Trade offer in ${ctx.leagueName}`,
      body,
      `${ctx.fromFactionName} proposed a trade`
    );
  } catch (err) {
    console.warn("[email] notifyTradeProposed:", err);
  }
}

/** Proposer: recipient accepted; trade awaits GM approval. */
export async function notifyTradeAcceptedByRecipient(proposalId: string): Promise<void> {
  try {
    const ctx = await loadTradeEmailContext(proposalId);
    if (!ctx) return;
    const url = proposalsUrl(ctx.leagueSlug);
    const body = `
      <p style="font-size:16px;line-height:1.5;">Hi,</p>
      <p style="font-size:16px;line-height:1.5;"><strong>${escapeHtml(ctx.toFactionName)}</strong> accepted your trade offer. The league GM must approve it before wrestlers move.</p>
      ${tradeParagraph(ctx)}
      ${emailButton(url, "View trade status")}
      ${emailMutedLink(url)}`;
    await sendToUser(
      ctx.fromUserId,
      (p) => p.notify_trade_accepted,
      `${ctx.toFactionName} accepted your trade`,
      body,
      "Your trade was accepted"
    );
    if (ctx.commissionerId) {
      await notifyGmTradePendingApproval(proposalId, ctx);
    }
  } catch (err) {
    console.warn("[email] notifyTradeAcceptedByRecipient:", err);
  }
}

/** Commissioner: trade accepted by both owners, needs GM approval. */
async function notifyGmTradePendingApproval(
  proposalId: string,
  ctx: TradeEmailContext
): Promise<void> {
  if (!ctx.commissionerId) return;
  const url = proposalsUrl(ctx.leagueSlug);
  const body = `
    <p style="font-size:16px;line-height:1.5;">Hi,</p>
    <p style="font-size:16px;line-height:1.5;">A trade in <strong>${escapeHtml(ctx.leagueName)}</strong> was accepted by both managers and needs your approval.</p>
    ${tradeParagraph(ctx)}
    ${emailButton(url, "Approve or decline")}
    ${emailMutedLink(url)}`;
  await sendToUser(
    ctx.commissionerId,
    (p) => p.notify_gm_trade_approval,
    `Trade awaiting your approval — ${ctx.leagueName}`,
    body,
    "Trade needs GM approval"
  );
}

/** Proposer: recipient declined the trade. */
export async function notifyTradeDeclinedByRecipient(proposalId: string): Promise<void> {
  try {
    const ctx = await loadTradeEmailContext(proposalId);
    if (!ctx) return;
    const url = proposalsUrl(ctx.leagueSlug);
    const body = `
      <p style="font-size:16px;line-height:1.5;">Hi,</p>
      <p style="font-size:16px;line-height:1.5;"><strong>${escapeHtml(ctx.toFactionName)}</strong> declined your trade offer.</p>
      ${tradeParagraph(ctx)}
      ${emailButton(url, "View trades")}
      ${emailMutedLink(url)}`;
    await sendToUser(
      ctx.fromUserId,
      (p) => p.notify_trade_accepted,
      `Trade declined in ${ctx.leagueName}`,
      body,
      "Your trade was declined"
    );
  } catch (err) {
    console.warn("[email] notifyTradeDeclinedByRecipient:", err);
  }
}

/** Both trade parties after GM approves or rejects. */
export async function notifyTradeGmDecision(
  proposalId: string,
  approved: boolean
): Promise<void> {
  try {
    const ctx = await loadTradeEmailContext(proposalId);
    if (!ctx) return;
    const url = proposalsUrl(ctx.leagueSlug);
    const headline = approved
      ? "Your trade was approved and completed."
      : "The league GM declined your trade.";
    const subject = approved
      ? `Trade completed — ${ctx.leagueName}`
      : `Trade declined by GM — ${ctx.leagueName}`;
    const body = `
      <p style="font-size:16px;line-height:1.5;">Hi,</p>
      <p style="font-size:16px;line-height:1.5;">${headline}</p>
      ${tradeParagraph(ctx)}
      ${emailButton(url, "View league activity")}
      ${emailMutedLink(url)}`;

    const pref = (p: import("@/lib/email/recipients").NotificationPrefs) => p.notify_trade_finalized;
    await Promise.all([
      sendToUser(ctx.fromUserId, pref, subject, body, headline),
      sendToUser(ctx.toUserId, pref, subject, body, headline),
    ]);
  } catch (err) {
    console.warn("[email] notifyTradeGmDecision:", err);
  }
}

export type EventScoresPublishedParams = {
  eventId: string;
  name: string;
  date: string | null;
};

/** Active league members when an event is marked completed with scores. */
export async function notifyEventScoresPublished(
  params: EventScoresPublishedParams
): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    const admin = getAdminClient();
    if (!admin) return;

    const resultsPath = eventResultsHref({
      id: params.eventId,
      name: params.name,
      date: params.date,
    });
    const resultsUrl = absoluteUrl(resultsPath);
    const hubUrl = absoluteUrl("/");
    const dateLabel = params.date
      ? new Date(`${params.date}T12:00:00`).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";
    const eventTitle = params.name.trim() || "WWE event";

    let leaguesQuery = admin
      .from("leagues")
      .select("id")
      .in("draft_status", ["in_progress", "completed"])
      .eq("is_archived", false);

    let { data: activeLeagues, error: leagueErr } = await leaguesQuery;
    if (leagueErr && /is_archived/i.test(leagueErr.message ?? "")) {
      const fallback = await admin
        .from("leagues")
        .select("id")
        .in("draft_status", ["in_progress", "completed"]);
      activeLeagues = fallback.data;
      leagueErr = fallback.error;
    }
    if (leagueErr) {
      console.warn("[email] event scores leagues:", leagueErr.message);
      return;
    }

    const leagueIds = (activeLeagues ?? []).map((l) => (l as { id: string }).id).filter(Boolean);
    if (leagueIds.length === 0) return;

    const { data: members, error: memErr } = await admin
      .from("league_members")
      .select("user_id")
      .in("league_id", leagueIds);
    if (memErr) {
      console.warn("[email] event scores members:", memErr.message);
      return;
    }

    await sendEventScoresToUserIds(
      uniqueUserIds(members ?? []),
      eventTitle,
      dateLabel,
      resultsUrl,
      hubUrl
    );
  } catch (err) {
    console.warn("[email] notifyEventScoresPublished:", err);
  }
}

function uniqueUserIds(
  rows: { user_id: string }[]
): string[] {
  return [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
}

async function sendEventScoresToUserIds(
  userIds: string[],
  eventTitle: string,
  dateLabel: string,
  resultsUrl: string,
  hubUrl: string
): Promise<void> {
  const subject = dateLabel
    ? `Scores posted: ${eventTitle} (${dateLabel})`
    : `Scores posted: ${eventTitle}`;
  const body = `
    <p style="font-size:16px;line-height:1.5;">Hi,</p>
    <p style="font-size:16px;line-height:1.5;">Fantasy points for <strong>${escapeHtml(eventTitle)}</strong>${dateLabel ? ` on ${escapeHtml(dateLabel)}` : ""} are now available. Check your leagues for updated weekly totals.</p>
    ${emailButton(resultsUrl, "View event results")}
    <p style="font-size:14px;color:#666;">Or open your league hub:</p>
    ${emailMutedLink(hubUrl)}`;

  const chunkSize = 8;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((userId) =>
        sendToUser(
          userId,
          (p) => p.notify_event_scores,
          subject,
          body,
          `Scores are in for ${eventTitle}`
        )
      )
    );
  }
}
