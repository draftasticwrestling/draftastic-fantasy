const DISPLAY_NAME_MAX_LEN = 50;
const DISPLAY_NAME_ALLOWED = /^[A-Za-z0-9 _.'-]+$/;

export function validateProfileDisplayName(value: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > DISPLAY_NAME_MAX_LEN) {
    return { ok: false, error: `Display name must be ${DISPLAY_NAME_MAX_LEN} characters or fewer.` };
  }
  if (!DISPLAY_NAME_ALLOWED.test(trimmed)) {
    return {
      ok: false,
      error: "Display name contains unsupported characters. Use letters, numbers, spaces, and basic punctuation.",
    };
  }
  return { ok: true, value: trimmed };
}
