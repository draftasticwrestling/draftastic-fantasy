/**
 * All valid matches should have a dedicated detail route.
 * The detail page itself decides whether to render the enhanced PWBS hero
 * or the standard MatchCard fallback.
 */
export function shouldUseMatchDetailPage(match) {
  return Boolean(match && typeof match === "object");
}

