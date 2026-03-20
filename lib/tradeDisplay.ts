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
