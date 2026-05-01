import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  getSortedMatchesForEvent,
  prioritizeExplicitMainEventMatches,
} from "@/components/boxscore-port/utils/eventMatchesOrder.js";
import { getEventShowType } from "@/lib/boxscore/eventShowHeader";
import type { HubPreviewEventRow } from "@/lib/home/hubHomeEvents";
import { splitUpcomingMatchSides } from "@/lib/home/hubUpcomingMatchSides";
import { eventResultsHref } from "@/lib/event-results/eventResultsRoute";
import { isWrestlerWinner } from "@/lib/event-results/winnerUtils";
import { extractMatchParticipants, normalizeWrestlerName } from "@/lib/scoring/parsers/participantParser.js";
import { scoreEvent } from "@/lib/scoring/scoreEvent.js";
import type { ScoredEvent, ScoredMatch } from "@/lib/scoring/types";

export type { HubPreviewEventRow };

type WrestlerRow = { id: string; name: string | null; image_url: string | null };

function cleanImageSrc(src: string | null | undefined): string | null {
  if (typeof src !== "string") return null;
  const cleaned = src.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function formatEventDateBar(dateStr: string | null): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
    return `${month} ${Number(d)}, ${y}`;
  }
  return dateStr;
}

function centerLines(raw: Record<string, unknown>, sm: ScoredMatch): { primary: string; method: string } {
  const cardType = typeof raw.cardType === "string" ? raw.cardType : "";
  const title = typeof raw.title === "string" && raw.title !== "None" ? raw.title : "";
  const matchType = typeof raw.matchType === "string" ? raw.matchType : "";

  let primary = "";
  if (cardType === "Main Event") primary = "Main Event";
  else if (title) primary = title;
  else if (matchType && matchType.toLowerCase() !== "promo") primary = matchType;
  else primary = "Match";

  const methodRaw = (sm.method as string | undefined) || (typeof raw.method === "string" ? raw.method : "");
  const method = methodRaw.trim() ? `via ${methodRaw.trim()}` : "";

  return { primary, method };
}

function centerLinesUpcoming(raw: Record<string, unknown>): { primary: string; method: string } {
  const cardType = typeof raw.cardType === "string" ? raw.cardType : "";
  const title = typeof raw.title === "string" && raw.title !== "None" ? raw.title : "";
  const matchType = typeof raw.matchType === "string" ? raw.matchType : "";

  let primary = "";
  if (cardType === "Main Event") primary = "Main Event";
  else if (title) primary = title;
  else if (matchType && matchType.toLowerCase() !== "promo") primary = matchType;
  else primary = "Match";

  return { primary, method: "Scheduled" };
}

function isRawPromo(raw: Record<string, unknown>): boolean {
  const mt = String(raw.matchType || "").toLowerCase();
  const st = String(raw.stipulation || "").toLowerCase();
  return mt === "promo" || st === "promo";
}

function buildWrestlerMap(wrestlerRows: WrestlerRow[]) {
  const wrestlerMap: Record<string, { name: string; image_url: string | null }> = {};
  for (const w of wrestlerRows) {
    const id = String(w.id ?? "").trim();
    if (id) wrestlerMap[id] = { name: (w.name ?? id).trim(), image_url: cleanImageSrc(w.image_url) };
  }
  return wrestlerMap;
}

type WrestlerMap = ReturnType<typeof buildWrestlerMap>;

function hubMatchBlockHeader(ptsHeader: string) {
  return (
    <div className="hub-condensed-header hub-match-block-header" aria-hidden>
      <span />
      <span className="hub-condensed-h-center">Match</span>
      <span className="hub-condensed-h-points">{ptsHeader}</span>
    </div>
  );
}

function upcomingParticipantRow(nm: string, rowKey: string, wrestlerMap: WrestlerMap): ReactNode {
  const slug = normalizeWrestlerName(nm) || nm.toLowerCase().replace(/\s+/g, "-");
  const meta = wrestlerMap[slug];
  const displayName = meta?.name || nm;
  const img = meta?.image_url;
  return (
    <div key={rowKey} className="hub-condensed-row hub-condensed-row-participant">
      <div className="hub-condensed-side">
        <div className="hub-condensed-participant">
          <span className="hub-condensed-arrow-cell" aria-hidden>
            <span className="hub-condensed-arrow-spacer" />
          </span>
          {img ? (
            <Image
              src={img}
              alt=""
              width={24}
              height={24}
              sizes="24px"
              className="hub-condensed-avatar"
            />
          ) : (
            <div className="hub-condensed-avatar hub-condensed-avatar-ph" aria-hidden>
              &#128100;
            </div>
          )}
          <span className="hub-condensed-name">{displayName}</span>
        </div>
      </div>
      <div className="hub-condensed-center hub-condensed-center-empty" aria-hidden />
      <div className="hub-condensed-points">
        <div className="hub-condensed-pts-line hub-condensed-pts-muted">—</div>
      </div>
    </div>
  );
}

function hubVsDividerRow(key: string, primary: string, method: string) {
  const methodLine = method.trim();
  return (
    <div key={key} className="hub-condensed-row hub-condensed-row-vs">
      <div className="hub-condensed-side">
        <div className="hub-condensed-participant hub-condensed-vs-participant">
          <span className="hub-condensed-arrow-cell" aria-hidden>
            <span className="hub-condensed-arrow-spacer" />
          </span>
          <div className="hub-condensed-vs-avatar-spacer" aria-hidden />
          <span className="hub-condensed-vs" aria-label="versus">
            vs
          </span>
        </div>
      </div>
      <div className="hub-condensed-center hub-condensed-vs-center">
        <div className={primary === "Main Event" ? "hub-condensed-primary hub-condensed-primary-main" : "hub-condensed-primary"}>
          {primary}
        </div>
        {methodLine ? <div className="hub-condensed-method">{methodLine}</div> : null}
      </div>
      <div className="hub-condensed-points">
        <div className="hub-condensed-pts-line hub-condensed-pts-muted">—</div>
      </div>
    </div>
  );
}

function hubMetaStrip(primary: string, method: string, reactKey?: string) {
  const methodLine = method.trim();
  return (
    <div key={reactKey} className="hub-match-meta-strip">
      <div className={primary === "Main Event" ? "hub-condensed-primary hub-condensed-primary-main" : "hub-condensed-primary"}>
        {primary}
      </div>
      {methodLine ? <div className="hub-condensed-method">{methodLine}</div> : null}
    </div>
  );
}

type CompletedEntry = {
  wp: { wrestler: string; total?: number };
  slug: string;
  isWinner: boolean;
};

function findCompletedEntryForName(participantName: string, list: CompletedEntry[]): CompletedEntry | undefined {
  const n = normalizeWrestlerName(participantName);
  return (
    list.find((e) => normalizeWrestlerName(e.wp.wrestler) === n) ||
    list.find((e) => e.slug === n) ||
    list.find((e) => String(e.wp.wrestler).trim() === String(participantName).trim())
  );
}

function completedParticipantRow(entry: CompletedEntry, rowKey: string, wrestlerMap: WrestlerMap): ReactNode {
  const { wp, slug, isWinner } = entry;
  const meta = wrestlerMap[slug];
  const displayName = meta?.name || wp.wrestler;
  const img = meta?.image_url;
  const pts = Number(wp.total ?? 0);
  const label = pts >= 0 ? `+${pts}` : String(pts);
  return (
    <div key={rowKey} className="hub-condensed-row hub-condensed-row-participant">
      <div className="hub-condensed-side">
        <div className="hub-condensed-participant">
          <span className="hub-condensed-arrow-cell" aria-hidden>
            {isWinner ? <span className="hub-condensed-arrow">▶</span> : <span className="hub-condensed-arrow-spacer" />}
          </span>
          {img ? (
            <Image
              src={img}
              alt=""
              width={24}
              height={24}
              sizes="24px"
              className="hub-condensed-avatar"
            />
          ) : (
            <div className="hub-condensed-avatar hub-condensed-avatar-ph" aria-hidden>
              &#128100;
            </div>
          )}
          <span className={`hub-condensed-name ${isWinner ? "hub-condensed-name-winner" : ""}`}>{displayName}</span>
        </div>
      </div>
      <div className="hub-condensed-center hub-condensed-center-empty" aria-hidden />
      <div className="hub-condensed-points">
        <div className="hub-condensed-pts-line">{label}</div>
      </div>
    </div>
  );
}

function completedParticipantFallbackRow(nm: string, rowKey: string, wrestlerMap: WrestlerMap): ReactNode {
  const slug = normalizeWrestlerName(nm) || nm.toLowerCase().replace(/\s+/g, "-");
  const meta = wrestlerMap[slug];
  const displayName = meta?.name || nm;
  const img = meta?.image_url;
  return (
    <div key={rowKey} className="hub-condensed-row hub-condensed-row-participant">
      <div className="hub-condensed-side">
        <div className="hub-condensed-participant">
          <span className="hub-condensed-arrow-cell" aria-hidden>
            <span className="hub-condensed-arrow-spacer" />
          </span>
          {img ? (
            <Image
              src={img}
              alt=""
              width={24}
              height={24}
              sizes="24px"
              className="hub-condensed-avatar"
            />
          ) : (
            <div className="hub-condensed-avatar hub-condensed-avatar-ph" aria-hidden>
              &#128100;
            </div>
          )}
          <span className="hub-condensed-name">{displayName}</span>
        </div>
      </div>
      <div className="hub-condensed-center hub-condensed-center-empty" aria-hidden />
      <div className="hub-condensed-points">
        <div className="hub-condensed-pts-line hub-condensed-pts-muted">—</div>
      </div>
    </div>
  );
}

export default function HubLatestEventPreview({
  event,
  wrestlerRows = [],
  variant = "completed",
  whenLabel,
  /** When set (including `[]`), only these match `order` values (after default fill) are rendered. Omit for full card. */
  allowedMatchOrders,
  /** Shown when there are no match blocks (e.g. filtered roster view). */
  fallbackOverride,
}: {
  event: HubPreviewEventRow;
  wrestlerRows: WrestlerRow[];
  variant?: "completed" | "upcoming" | "live";
  whenLabel?: "Tonight" | "Tomorrow" | "Upcoming";
  allowedMatchOrders?: number[];
  fallbackOverride?: string;
}) {
  const wrestlerMap = buildWrestlerMap(wrestlerRows);
  const sortedBase = getSortedMatchesForEvent(event);
  const sorted =
    variant === "live" || variant === "completed"
      ? prioritizeExplicitMainEventMatches(sortedBase)
      : sortedBase;
  const orderFilter = allowedMatchOrders !== undefined ? new Set(allowedMatchOrders) : null;

  const barParts =
    variant === "upcoming" && whenLabel
      ? [whenLabel, formatEventDateBar(event.date), event.name?.trim() || null, event.location?.trim() || null]
      : variant === "live"
        ? ["LIVE", formatEventDateBar(event.date), event.name?.trim() || null, event.location?.trim() || null]
        : [formatEventDateBar(event.date), event.name?.trim() || null, event.location?.trim() || null];
  const barText = barParts.filter(Boolean).join(" — ");

  const maxMatches = 8;
  const maxParticipantsPerMatch = 12;
  const matchBlocks: ReactNode[] = [];
  const ptsHeader = variant === "upcoming" ? "Pts" : "Points";

  if (variant === "upcoming") {
    let shown = 0;
    for (let i = 0; i < sorted.length && shown < maxMatches; i++) {
      const raw = sorted[i] as Record<string, unknown>;
      if (isRawPromo(raw)) continue;
      const ordUp = Number((raw.order as number) ?? i + 1);
      if (orderFilter && !orderFilter.has(ordUp)) continue;
      shown++;

      const { primary, method } = centerLinesUpcoming(raw);
      let names: string[] = [];
      try {
        const md = extractMatchParticipants(raw as never);
        const list = md.participantsForScoring ?? [];
        names = list.map((n) => String(n).trim()).filter(Boolean);
      } catch {
        names = [];
      }
      const overflow = Math.max(0, names.length - maxParticipantsPerMatch);
      const displayNames = overflow > 0 ? names.slice(0, maxParticipantsPerMatch) : names;
      const sides = splitUpcomingMatchSides(raw);
      const flatSides = sides?.flat() ?? [];
      const useVs =
        Boolean(sides && sides.length >= 2 && flatSides.length <= maxParticipantsPerMatch && overflow === 0);

      const rowBase = `up-${(raw.order as number) ?? i}`;
      let rk = 0;

      if (displayNames.length === 0) {
        matchBlocks.push(
          <div key={rowBase} className="hub-match-block">
            {hubMatchBlockHeader(ptsHeader)}
            {hubMetaStrip(primary, method, `${rowBase}-meta`)}
            <div className="hub-condensed-row hub-condensed-row-participant">
              <div className="hub-condensed-side">
                <div className="hub-condensed-participant">
                  <span className="hub-condensed-arrow-cell" aria-hidden>
                    <span className="hub-condensed-arrow-spacer" />
                  </span>
                  <div className="hub-condensed-vs-avatar-spacer" aria-hidden />
                  <span className="hub-condensed-name-only">Card TBD</span>
                </div>
              </div>
              <div className="hub-condensed-center hub-condensed-center-empty" aria-hidden />
              <div className="hub-condensed-points">
                <div className="hub-condensed-pts-line hub-condensed-pts-muted">—</div>
              </div>
            </div>
          </div>
        );
        continue;
      }

      const rowsInner: ReactNode[] = [];

      if (useVs && sides) {
        sides.forEach((side, si) => {
          if (si > 0) {
            rowsInner.push(hubVsDividerRow(`${rowBase}-vs-${si}`, primary, method));
          }
          for (const nm of side) {
            rowsInner.push(upcomingParticipantRow(nm, `${rowBase}-p-${rk++}`, wrestlerMap));
          }
        });
      } else {
        rowsInner.push(hubMetaStrip(primary, method, `${rowBase}-meta`));
        for (const nm of displayNames) {
          rowsInner.push(upcomingParticipantRow(nm, `${rowBase}-p-${rk++}`, wrestlerMap));
        }
        if (overflow > 0) {
          rowsInner.push(
            <div key={`${rowBase}-more`} className="hub-condensed-row hub-condensed-row-morehint">
              <div className="hub-condensed-side">
                <div className="hub-condensed-participant">
                  <span className="hub-condensed-arrow-cell" aria-hidden>
                    <span className="hub-condensed-arrow-spacer" />
                  </span>
                  <div className="hub-condensed-vs-avatar-spacer" aria-hidden />
                  <span className="hub-condensed-more">+{overflow} more on full card</span>
                </div>
              </div>
              <div className="hub-condensed-center hub-condensed-center-empty" aria-hidden />
              <div className="hub-condensed-points hub-condensed-vs-skip" />
            </div>
          );
        }
      }

      matchBlocks.push(
        <div key={rowBase} className="hub-match-block">
          {hubMatchBlockHeader(ptsHeader)}
          {rowsInner}
        </div>
      );
    }
  } else {
    const scored = scoreEvent({ ...event, matches: sorted }) as ScoredEvent;
    let shown = 0;

    const scoredForRaw = (raw: Record<string, unknown>, i: number): ScoredMatch | undefined => {
      const ord = raw.order != null && raw.order !== "" ? Number(raw.order) : i + 1;
      const byOrder = scored.matches.find((m) => Number((m as ScoredMatch).order) === ord);
      return (byOrder ?? scored.matches[i]) as ScoredMatch | undefined;
    };

    for (let i = 0; i < sorted.length && shown < maxMatches; i++) {
      const raw = sorted[i] as Record<string, unknown>;
      if (isRawPromo(raw)) continue;
      const ordSc = Number((raw.order as number) ?? i + 1);
      if (orderFilter && !orderFilter.has(ordSc)) continue;

      const sm = scoredForRaw(raw, i);
      if (!sm || sm.isPromo) continue;

      shown++;

      const { primary, method } = centerLines(raw, sm);
      const wps = sm.wrestlerPoints ?? [];
      const entriesFull = wps.map((wp, j) => ({
        wp,
        j,
        slug: normalizeWrestlerName(wp.wrestler) || String(wp.wrestler).toLowerCase().replace(/\s+/g, "-"),
        isWinner: isWrestlerWinner(wp.wrestler, sm.winners, normalizeWrestlerName),
      }));
      entriesFull.sort((a, b) => Number(a.isWinner) - Number(b.isWinner) || a.j - b.j);
      const overflow = Math.max(0, entriesFull.length - maxParticipantsPerMatch);
      const entries = overflow > 0 ? entriesFull.slice(0, maxParticipantsPerMatch) : entriesFull;
      const entriesTyped = entries as CompletedEntry[];

      const rowBase = `m-${sm.order ?? i}`;
      let rk = 0;
      const sides = splitUpcomingMatchSides(raw);
      const flatSides = sides?.flat() ?? [];
      const useVs =
        Boolean(sides && sides.length >= 2 && flatSides.length <= maxParticipantsPerMatch && overflow === 0);

      const rowsInner: ReactNode[] = [];

      if (entries.length === 0) {
        rowsInner.push(
          <div key={`empty-r-${i}`} className="hub-condensed-row hub-condensed-row-participant">
            <div className="hub-condensed-side">
              <div className="hub-condensed-participant">
                <span className="hub-condensed-arrow-cell" aria-hidden>
                  <span className="hub-condensed-arrow-spacer" />
                </span>
                <div className="hub-condensed-vs-avatar-spacer" aria-hidden />
                <span className="hub-condensed-name-only">—</span>
              </div>
            </div>
            <div className="hub-condensed-center hub-condensed-center-empty" aria-hidden />
            <div className="hub-condensed-points" />
          </div>
        );
        matchBlocks.push(
          <div key={`empty-${i}`} className="hub-match-block">
            {hubMatchBlockHeader(ptsHeader)}
            {hubMetaStrip(primary, method, `empty-${i}-meta`)}
            {rowsInner}
          </div>
        );
        continue;
      }

      if (useVs && sides) {
        sides.forEach((side, si) => {
          if (si > 0) {
            rowsInner.push(hubVsDividerRow(`${rowBase}-vs-${si}`, primary, method));
          }
          const ordered = side.map((nm) => ({ nm, entry: findCompletedEntryForName(nm, entriesTyped) }));
          ordered.sort((a, b) => {
            const aw = a.entry ? Number(a.entry.isWinner) : 0;
            const bw = b.entry ? Number(b.entry.isWinner) : 0;
            if (bw !== aw) return bw - aw;
            return 0;
          });
          for (const { nm, entry } of ordered) {
            if (entry) {
              rowsInner.push(completedParticipantRow(entry, `${rowBase}-p-${rk++}`, wrestlerMap));
            } else {
              rowsInner.push(completedParticipantFallbackRow(nm, `${rowBase}-p-${rk++}`, wrestlerMap));
            }
          }
        });
      } else {
        rowsInner.push(hubMetaStrip(primary, method, `${rowBase}-meta`));
        for (const entry of entriesTyped) {
          rowsInner.push(completedParticipantRow(entry, `${rowBase}-p-${rk++}`, wrestlerMap));
        }
        if (overflow > 0) {
          rowsInner.push(
            <div key={`${rowBase}-more`} className="hub-condensed-row hub-condensed-row-morehint">
              <div className="hub-condensed-side">
                <div className="hub-condensed-participant">
                  <span className="hub-condensed-arrow-cell" aria-hidden>
                    <span className="hub-condensed-arrow-spacer" />
                  </span>
                  <div className="hub-condensed-vs-avatar-spacer" aria-hidden />
                  <span className="hub-condensed-more">+{overflow} more on full card</span>
                </div>
              </div>
              <div className="hub-condensed-center hub-condensed-center-empty" aria-hidden />
              <div className="hub-condensed-points">
                <div className="hub-condensed-pts-line hub-condensed-pts-muted">…</div>
              </div>
            </div>
          );
        }
      }

      matchBlocks.push(
        <div key={rowBase} className="hub-match-block">
          {hubMatchBlockHeader(ptsHeader)}
          {rowsInner}
        </div>
      );
    }
  }

  const href = eventResultsHref(event);
  const showType = getEventShowType(event);
  const brandBarClass =
    showType === "raw"
      ? "hub-event-bar-raw"
      : showType === "smackdown"
        ? "hub-event-bar-smackdown"
        : variant === "upcoming"
          ? "hub-event-bar-upcoming"
          : "";
  const barToneClass =
    variant === "live"
      ? `${brandBarClass} hub-event-bar-live`.trim()
      : brandBarClass;

  const cta = "View Event →";
  const fallbackDefault =
    variant === "upcoming"
      ? sorted.length === 0
        ? "No matches announced yet."
        : "Match details will appear here as the card is finalized — open for the full lineup."
      : variant === "live"
        ? "Scores update as matches finish — open for the full card."
        : "No scored matches to preview yet — open for full card and promos.";
  const fallback = fallbackOverride ?? fallbackDefault;

  return (
    <Link href={href} className="hub-event-preview-link">
      <div className={`hub-event-bar ${barToneClass}`}>
        <span className="hub-event-bar-text">{barText}</span>
      </div>
      <div className="hub-event-card hub-event-card-condensed">
        {matchBlocks.length > 0 ? (
          <div className="hub-match-blocks-wrap" role="presentation">
            {matchBlocks}
          </div>
        ) : (
          <p className="hub-muted hub-condensed-fallback">{fallback}</p>
        )}
        <span
          className={`hub-event-cta hub-event-cta-condensed ${showType === "raw" ? "hub-event-cta-raw" : ""}`}
        >
          {cta}
        </span>
      </div>
    </Link>
  );
}
