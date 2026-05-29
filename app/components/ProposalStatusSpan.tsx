import {
  getTradeProposalStatusDisplay,
  tradeProposalStatusColor,
} from "@/lib/tradeDisplay";

/** Release / free-agent row status. */
export function SimpleStatusSpan({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "approved" | "rejected" | "pending" | "neutral";
}) {
  const color =
    tone === "approved"
      ? "var(--color-success-muted)"
      : tone === "rejected"
        ? "var(--color-text-dim)"
        : tone === "pending"
          ? "var(--color-text-muted)"
          : "var(--color-text-dim)";
  return <span style={{ color, fontWeight: 500 }}>{label}</span>;
}

export function TradeProposalStatusSpan({ status }: { status: string }) {
  const { label, tone } = getTradeProposalStatusDisplay(status);
  return <span style={{ color: tradeProposalStatusColor(tone), fontWeight: 500 }}>{label}</span>;
}
