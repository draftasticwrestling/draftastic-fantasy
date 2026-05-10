/**
 * Maps Supabase Auth API errors to clearer copy. Rate-limit errors come from
 * Supabase’s auth email sender (built-in SMTP is heavily capped; custom SMTP + Dashboard rate limits fix production).
 */
export function mapSupabaseAuthErrorMessage(raw: string): string {
  const t = raw.trim();
  if (!t) return "Something went wrong. Please try again.";

  if (/rate limit|too many requests|over_email_send|email.*limit|429/i.test(t)) {
    return (
      "Our email sign-in service is temporarily limiting messages (too many were sent recently). " +
      "Wait a few minutes and try again, or use Sign in with Google, which does not rely on us sending you an email. " +
      "If this keeps happening, contact support."
    );
  }

  return t;
}
