/**
 * Match list order used on the event page (MatchCard list) and for `/events/:slug/match/:n` URLs.
 * Must stay in sync: MatchCard uses 1-based index into this list; MatchPageNewWrapper resolves the same index.
 *
 * Fills missing `order` with `index + 1` (same as EventBoxScore) before sorting, so it does not match
 * sorting raw matches with `order || 0` (which would put missing orders first).
 */
export function getSortedMatchesForEvent(event) {
  const base = Array.isArray(event?.matches) ? event.matches : [];
  const withDefaultOrder = base.map((m, idx) => ({
    ...m,
    order: m.order || idx + 1,
  }));
  return [...withDefaultOrder].sort((a, b) => (a.order || 0) - (b.order || 0));
}
