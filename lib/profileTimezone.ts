/**
 * Allowed IANA timezones for profiles (account settings, API validation).
 */

export const PROFILE_TIMEZONE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Central European (Paris)" },
  { value: "Europe/Berlin", label: "Central European (Berlin)" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "UTC", label: "UTC" },
] as const;

const ALLOWED = new Set(PROFILE_TIMEZONE_OPTIONS.map((o) => o.value));

export function validateProfileTimezone(raw: string | null | undefined): { ok: true; value: string } | { ok: false; error: string } {
  const t = (raw ?? "").trim();
  if (!t) return { ok: false, error: "Select a timezone." };
  if (!ALLOWED.has(t)) return { ok: false, error: "Select a valid timezone from the list." };
  return { ok: true, value: t };
}
