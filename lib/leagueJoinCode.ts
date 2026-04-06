/** Default lifetime for token invite links (days). */
export const INVITE_LINK_EXPIRY_DAYS = 365;

/** Readable charset without ambiguous I/O/0/1. */
const JOIN_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Format `XXXX-XXXX` for display and storage. */
export function generateJoinCode(): string {
  const pick = () =>
    JOIN_CODE_CHARSET[Math.floor(Math.random() * JOIN_CODE_CHARSET.length)] ?? "X";
  return `${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}

/** Normalize user input for matching (strip spaces/hyphens, uppercase). */
export function normalizeJoinCodeInput(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}
