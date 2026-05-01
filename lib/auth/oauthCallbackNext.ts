/**
 * OAuth codes are single-use. If middleware sends users to /auth/callback and sets
 * `next` to the original URL including ?code=..., the post-login redirect would reload
 * that URL, middleware would forward the consumed code again, and exchangeCodeForSession
 * fails → sign-in?error=callback.
 */

/** Path + query from the current request URL, with OAuth params stripped. */
export function oauthLandingNextFromRequestUrl(url: URL): string {
  const path = url.pathname;
  const sp = new URLSearchParams(url.searchParams);
  sp.delete("code");
  sp.delete("state");
  const q = sp.toString();
  return q ? `${path}?${q}` : path;
}

/** Ensure internal next path never carries a consumed OAuth code/state. */
export function sanitizeRelativeNext(nextRaw: string, origin: string): string {
  const t = nextRaw.trim();
  if (!t.startsWith("/")) return "/";
  try {
    const u = new URL(t, origin);
    u.searchParams.delete("code");
    u.searchParams.delete("state");
    return `${u.pathname}${u.search}`;
  } catch {
    return "/";
  }
}
