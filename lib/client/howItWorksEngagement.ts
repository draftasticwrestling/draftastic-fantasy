/** Browser flag: user viewed /how-it-works before signing in. Merged on first authenticated session. */
export const HOW_IT_WORKS_VIEWED_STORAGE_KEY = "draftastic_how_it_works_viewed";

export function markAnonymousHowItWorksViewed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOW_IT_WORKS_VIEWED_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasAnonymousHowItWorksViewed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HOW_IT_WORKS_VIEWED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearAnonymousHowItWorksViewed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HOW_IT_WORKS_VIEWED_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Record a pre-signup how-it-works view for the logged-in user, then clear the local flag. */
export async function mergeAnonymousHowItWorksViewIfNeeded(): Promise<void> {
  if (!hasAnonymousHowItWorksViewed()) return;
  try {
    const res = await fetch("/api/engagement/how-it-works-view", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
    });
    if (res.ok) clearAnonymousHowItWorksViewed();
  } catch {
    /* ignore */
  }
}
