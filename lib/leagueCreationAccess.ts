import { timingSafeEqual } from "node:crypto";

/**
 * Comma-separated list of secrets (server env only). When non-empty, "Create a league" requires a match.
 * Example: LEAGUE_CREATION_ACCESS_CODES=beta-winter-2026,another-code
 * If unset or empty, league creation is not gated (local development).
 * Users with profiles.is_site_admin bypass this gate (and beta-only league-type limits) unless they
 * use the form toggle to preview the standard flow (enforce_standard_create_rules=1) — see createLeagueAction.
 */
function parseCodesFromEnv(): string[] {
  const raw = process.env.LEAGUE_CREATION_ACCESS_CODES?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

export function leagueCreationAccessIsConfigured(): boolean {
  return parseCodesFromEnv().length > 0;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** When no codes are configured, returns true (no gate). */
export function validateLeagueCreationAccessCode(input: string): boolean {
  const codes = parseCodesFromEnv();
  if (codes.length === 0) return true;
  const trimmed = input.trim();
  for (const secret of codes) {
    if (timingSafeEqualStrings(trimmed, secret)) return true;
  }
  return false;
}
