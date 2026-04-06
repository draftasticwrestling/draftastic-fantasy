/** Max length for `league_members.manager_catchphrase`. */
export const MANAGER_CATCHPHRASE_MAX_LENGTH = 60;

export function validateManagerCatchphraseForSave(
  raw: string | null
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw == null || !String(raw).trim()) return { ok: true, value: null };
  const t = String(raw).trim();
  if (t.length > MANAGER_CATCHPHRASE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Catchphrase must be ${MANAGER_CATCHPHRASE_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: t };
}
