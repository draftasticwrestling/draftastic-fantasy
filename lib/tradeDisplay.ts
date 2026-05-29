/**
 * Human-readable bits for trade UI (roster cuts, name lists).
 */

/** Join wrestler (or other) names for prose: "A", "A and B", "A, B, and C". */
export function joinNamesForProse(names: string[]): string {
  const n = names.map((s) => String(s).trim()).filter(Boolean);
  if (n.length === 0) return "";
  if (n.length === 1) return n[0];
  if (n.length === 2) return `${n[0]} and ${n[1]}`;
  return `${n.slice(0, -1).join(", ")}, and ${n[n.length - 1]}`;
}

/**
 * Second line for trade snippets when the recipient agreed to roster cuts (2-for-1, etc.).
 * Example: "Dillster also releases: Sami Zayn"
 */
export function formatRecipientRosterCutsLine(
  recipientDisplayName: string,
  dropWrestlerNames: string[]
): string | null {
  const joined = joinNamesForProse(dropWrestlerNames);
  if (!joined) return null;
  const who = recipientDisplayName.trim() || "Recipient";
  return `${who} also releases: ${joined}`;
}

/** Append roster-cut sentence to a trade description paragraph, or return base unchanged. */
export function appendRecipientCutsToDescription(
  baseDescription: string,
  recipientDisplayName: string,
  dropWrestlerNames: string[]
): string {
  const line = formatRecipientRosterCutsLine(recipientDisplayName, dropWrestlerNames);
  if (!line) return baseDescription;
  return `${baseDescription} ${line}.`;
}

export type TradeProposalCopyInput = {
  status: string;
  fromLabel: string;
  toLabel: string;
  giveStr: string;
  receiveStr: string;
  dropNames?: string[];
};

export type TradeProposalStatusTone = "completed" | "pending" | "awaiting_gm" | "declined" | "neutral";

/** True only when wrestlers actually moved (GM approved execution). */
export function isTradeProposalCompleted(status: string): boolean {
  return status === "gm_approved" || status === "accepted";
}

export function getTradeProposalStatusDisplay(status: string): {
  label: string;
  tone: TradeProposalStatusTone;
} {
  switch (status) {
    case "gm_approved":
    case "accepted":
      return { label: "Completed", tone: "completed" };
    case "awaiting_gm_approval":
      return { label: "Awaiting GM approval", tone: "awaiting_gm" };
    case "pending":
      return { label: "Pending", tone: "pending" };
    case "rejected":
      return { label: "Declined by owner", tone: "declined" };
    case "gm_rejected":
      return { label: "Denied by GM", tone: "declined" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    case "expired":
      return { label: "Expired", tone: "neutral" };
    default:
      return { label: status.replace(/_/g, " "), tone: "neutral" };
  }
}

export function tradeProposalStatusColor(tone: TradeProposalStatusTone): string {
  switch (tone) {
    case "completed":
      return "var(--color-success-muted)";
    case "pending":
      return "var(--color-text-muted)";
    case "awaiting_gm":
      return "var(--color-warning)";
    case "declined":
      return "var(--color-red)";
    default:
      return "var(--color-text-dim)";
  }
}

function offerPhrase(giveStr: string, receiveStr: string): string {
  return `${giveStr} for ${receiveStr}`;
}

/** League roster-changes table: third-person description by proposal status. */
export function formatLeagueTradeProposalDescription(input: TradeProposalCopyInput): string {
  const { status, fromLabel, toLabel, giveStr, receiveStr } = input;
  const offer = offerPhrase(giveStr, receiveStr);
  let base: string;
  switch (status) {
    case "gm_approved":
    case "accepted":
      base = `${fromLabel} traded ${giveStr} to ${toLabel} for ${receiveStr}`;
      break;
    case "pending":
      base = `${fromLabel} proposed trading ${giveStr} to ${toLabel} for ${receiveStr}`;
      break;
    case "awaiting_gm_approval":
      base = `${fromLabel} and ${toLabel} agreed to trade ${offer}`;
      break;
    case "rejected":
      base = `${toLabel} declined trade offer (${fromLabel} offered ${offer})`;
      break;
    case "gm_rejected":
      base = `GM denied trade (${fromLabel} ↔ ${toLabel}, ${offer})`;
      break;
    case "cancelled":
      base = `${fromLabel} cancelled trade offer with ${toLabel} (${offer})`;
      break;
    case "expired":
      base = `Trade offer expired (${fromLabel} ↔ ${toLabel}, ${offer})`;
      break;
    default:
      base = `${fromLabel} proposed trading ${giveStr} to ${toLabel} for ${receiveStr}`;
  }
  return appendRecipientCutsToDescription(base, toLabel, input.dropNames ?? []);
}

/** User transactions table: first-person description by status and viewer role. */
export function formatUserTradeProposalDescription(
  input: TradeProposalCopyInput & {
    viewerUserId: string;
    fromUserId: string;
    toUserId: string;
  }
): string {
  const { status, fromLabel, toLabel, giveStr, receiveStr, viewerUserId, fromUserId, toUserId } = input;
  const offer = offerPhrase(giveStr, receiveStr);
  const isProposer = viewerUserId === fromUserId;
  const isRecipient = viewerUserId === toUserId;
  const otherLabel = isProposer ? toLabel : isRecipient ? fromLabel : toLabel;

  let base: string;
  switch (status) {
    case "gm_approved":
    case "accepted":
      base = isProposer
        ? `Traded ${giveStr} to ${toLabel} for ${receiveStr}`
        : isRecipient
          ? `Received ${giveStr} from ${fromLabel} for ${receiveStr}`
          : `${fromLabel} traded ${giveStr} to ${toLabel} for ${receiveStr}`;
      break;
    case "pending":
      base = isProposer
        ? `Proposed trading ${giveStr} to ${toLabel} for ${receiveStr}`
        : isRecipient
          ? `Trade offer from ${fromLabel}: ${offer}`
          : `${fromLabel} proposed trading ${offer} with ${toLabel}`;
      break;
    case "awaiting_gm_approval":
      base = `Agreed to trade with ${otherLabel} (${offer}) — awaiting GM approval`;
      break;
    case "rejected":
      base = isProposer
        ? `${toLabel} declined your trade offer (${offer})`
        : isRecipient
          ? `You declined trade offer from ${fromLabel} (${offer})`
          : `${toLabel} declined trade offer (${offer})`;
      break;
    case "gm_rejected":
      base = `GM denied trade with ${otherLabel} (${offer})`;
      break;
    case "cancelled":
      base = isProposer
        ? `You cancelled trade offer with ${toLabel} (${offer})`
        : `${fromLabel} cancelled trade offer (${offer})`;
      break;
    case "expired":
      base = `Trade offer with ${otherLabel} expired (${offer})`;
      break;
    default:
      base = isProposer
        ? `Proposed trading ${giveStr} to ${toLabel} for ${receiveStr}`
        : `Trade offer from ${fromLabel}: ${offer}`;
  }
  return appendRecipientCutsToDescription(base, toLabel, input.dropNames ?? []);
}
