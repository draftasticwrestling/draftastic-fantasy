/**
 * PWBS EditEvent `handleSaveEvent` — regenerate BR / RR / EC result strings before persisting.
 * @see wrestling-boxscore/src/App.jsx (regenerateBattleRoyalResult, etc.)
 */

export type WrestlerNameRow = { id: string; name?: string | null };

function wrestlerName(wrestlers: WrestlerNameRow[], slug: string): string {
  return wrestlers.find((w) => w.id === slug)?.name ?? slug;
}

export function regenerateBattleRoyalResult(
  match: Record<string, unknown>,
  wrestlers: WrestlerNameRow[],
  eventStatus: string
): string | unknown {
  const matchType = String(match.matchType ?? "");
  const stipulation = String(match.stipulation ?? "");
  if (
    (matchType !== "Battle Royal" && stipulation !== "Battle Royal") ||
    !match.winner ||
    eventStatus !== "completed"
  ) {
    return match.result;
  }

  const winnerName = wrestlerName(wrestlers, String(match.winner));
  const brData = match.battleRoyalData as { eliminations?: unknown[] } | undefined;
  const eliminations = brData?.eliminations;

  if (Array.isArray(eliminations)) {
    const valid = eliminations.filter(
      (e): e is Record<string, unknown> =>
        !!e &&
        typeof e === "object" &&
        !!(e as Record<string, unknown>).eliminated &&
        !!(e as Record<string, unknown>).eliminatedBy
    );
    if (valid.length > 0) {
      const elimStrings = valid.map((elim) => {
        const eliminatedName = wrestlerName(wrestlers, String(elim.eliminated));
        const eliminatedByName = wrestlerName(wrestlers, String(elim.eliminatedBy));
        const eliminatedBy2 = elim.eliminatedBy2 ? wrestlerName(wrestlers, String(elim.eliminatedBy2)) : null;
        const time = elim.time ? ` (${elim.time})` : "";
        if (eliminatedBy2) {
          return `${eliminatedByName} & ${eliminatedBy2} eliminated ${eliminatedName}${time}`;
        }
        return eliminatedByName
          ? `${eliminatedByName} eliminated ${eliminatedName}${time}`
          : eliminatedName;
      });
      return `${winnerName} won the Battle Royal [Eliminations: ${elimStrings.join(" → ")}]`;
    }
  }

  return `${winnerName} won the Battle Royal`;
}

export function regenerateRoyalRumbleResult(
  match: Record<string, unknown>,
  wrestlers: WrestlerNameRow[],
  eventStatus: string
): string | unknown {
  const matchType = String(match.matchType ?? "");
  const stipulation = String(match.stipulation ?? "");
  if (
    (matchType !== "Royal Rumble" && stipulation !== "Royal Rumble") ||
    !match.winner ||
    eventStatus !== "completed"
  ) {
    return match.result;
  }

  const winnerName = wrestlerName(wrestlers, String(match.winner));
  const rrData = match.royalRumbleData as { eliminations?: unknown[] } | undefined;
  const eliminations = rrData?.eliminations;

  if (Array.isArray(eliminations)) {
    const valid = eliminations.filter(
      (e): e is Record<string, unknown> =>
        !!e &&
        typeof e === "object" &&
        !!(e as Record<string, unknown>).eliminated &&
        !!(e as Record<string, unknown>).eliminatedBy
    );
    if (valid.length > 0) {
      const elimStrings = valid.map((elim) => {
        const eliminatedName = wrestlerName(wrestlers, String(elim.eliminated));
        const eliminatedByName = wrestlerName(wrestlers, String(elim.eliminatedBy));
        const eliminatedBy2 = elim.eliminatedBy2 ? wrestlerName(wrestlers, String(elim.eliminatedBy2)) : null;
        const time = elim.time ? ` (${elim.time})` : "";
        if (eliminatedBy2) {
          return `${eliminatedByName} & ${eliminatedBy2} eliminated ${eliminatedName}${time}`;
        }
        return eliminatedByName
          ? `${eliminatedByName} eliminated ${eliminatedName}${time}`
          : eliminatedName;
      });
      return `${winnerName} won the Royal Rumble [Eliminations: ${elimStrings.join(" → ")}]`;
    }
  }

  return `${winnerName} won the Royal Rumble`;
}

export function regenerateEliminationChamberResult(
  match: Record<string, unknown>,
  wrestlers: WrestlerNameRow[],
  eventStatus: string
): string | unknown {
  const matchType = String(match.matchType ?? "");
  const stipulation = String(match.stipulation ?? "");
  if (
    (matchType !== "Elimination Chamber" && stipulation !== "Elimination Chamber") ||
    !match.winner ||
    eventStatus !== "completed"
  ) {
    return match.result;
  }

  const winnerName = wrestlerName(wrestlers, String(match.winner));
  const ecData = match.eliminationChamberData as { eliminations?: unknown[] } | undefined;
  const eliminations = ecData?.eliminations;

  if (Array.isArray(eliminations)) {
    const valid = eliminations.filter(
      (e): e is Record<string, unknown> =>
        !!e &&
        typeof e === "object" &&
        !!(e as Record<string, unknown>).eliminated &&
        (!!(e as Record<string, unknown>).eliminatedBy ||
          (e as Record<string, unknown>).method === "Referee decision")
    );
    if (valid.length > 0) {
      const elimStrings = valid.map((elim) => {
        const eliminatedName = wrestlerName(wrestlers, String(elim.eliminated));
        const methodPart = elim.method ? ` (${elim.method})` : "";
        const timePart = elim.time ? ` at ${elim.time}` : "";
        if (elim.method === "Referee decision" && !elim.eliminatedBy) {
          return `${eliminatedName} eliminated${methodPart}${timePart}`;
        }
        const eliminatedByName = wrestlerName(wrestlers, String(elim.eliminatedBy));
        const eliminatedBy2 = elim.eliminatedBy2 ? wrestlerName(wrestlers, String(elim.eliminatedBy2)) : null;
        if (eliminatedBy2) {
          return `${eliminatedByName} & ${eliminatedBy2} eliminated ${eliminatedName}${methodPart}${timePart}`;
        }
        return eliminatedByName
          ? `${eliminatedByName} eliminated ${eliminatedName}${methodPart}${timePart}`
          : eliminatedName;
      });
      return `${winnerName} won the Elimination Chamber [Eliminations: ${elimStrings.join(" → ")}]`;
    }
  }

  return `${winnerName} won the Elimination Chamber`;
}

/** Apply PWBS EditEvent pre-save result regeneration to every match on the card. */
export function applyResultRegenerationToMatches(
  matches: unknown[],
  wrestlers: WrestlerNameRow[],
  eventStatus: string
): Record<string, unknown>[] {
  return matches.map((m) => {
    if (!m || typeof m !== "object") return {};
    const match = { ...(m as Record<string, unknown>) };
    match.result = regenerateBattleRoyalResult(match, wrestlers, eventStatus);
    match.result = regenerateRoyalRumbleResult(match, wrestlers, eventStatus);
    match.result = regenerateEliminationChamberResult(match, wrestlers, eventStatus);
    return match;
  });
}
