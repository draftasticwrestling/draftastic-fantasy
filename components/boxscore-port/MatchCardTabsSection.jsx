'use client';

import React from 'react';
import { Link } from '@/components/boxscore-port/router-bridge';
import { shouldShowLastFiveStats } from './utils/matchOutcomes';

const pillBase = {
  padding: '6px 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  border: '2px solid #C6A04F',
  cursor: 'pointer',
  background: 'transparent',
  color: '#C6A04F',
};
const pillActive = { ...pillBase, background: '#C6A04F', color: '#232323' };

/**
 * Summary / Statistics block shared by MatchCard and MatchPageHero layouts.
 */
export default function MatchCardTabsSection({
  match,
  event,
  wrestlerMap,
  events,
  matchIndex,
  royalRumbleHighlights,
  wrestlerTo = undefined,
  summaryContent,
  hasSummary,
  statisticsExtraHint,
  cardView: cardViewControlled = undefined,
  setCardView: setCardViewControlled = undefined,
  /** When true (match page hero layout), no top border — tabs sit in their own card */
  standalone = false,
}) {
  const [cardViewInner, setCardViewInner] = React.useState('summary');
  const isControlled = cardViewControlled !== undefined && typeof setCardViewControlled === 'function';
  const cardView = isControlled ? cardViewControlled : cardViewInner;
  const setCardView = isControlled ? setCardViewControlled : setCardViewInner;

  /** See EventPageHeader: `innerWidth` + breakpoint-crossing only (matchMedia alone mis-fired on desktop in QA). */
  const [viewportNarrow, setViewportNarrow] = React.useState(false);
  const [mobileLongOpen, setMobileLongOpen] = React.useState(true);
  const prevNarrowRef = React.useRef(null);
  const toggleMobileLong = React.useCallback(() => {
    setMobileLongOpen((o) => !o);
  }, []);

  React.useLayoutEffect(() => {
    const sync = () => {
      const narrow = typeof window !== "undefined" && window.innerWidth <= 639;
      setViewportNarrow(narrow);
      if (prevNarrowRef.current === null) {
        prevNarrowRef.current = narrow;
        setMobileLongOpen(!narrow);
        return;
      }
      if (prevNarrowRef.current !== narrow) {
        prevNarrowRef.current = narrow;
        setMobileLongOpen(!narrow);
      }
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const toProfile =
    wrestlerTo ||
    ((slug) => `/wrestlers/${encodeURIComponent(String(slug ?? '').trim())}`);

  const showStatsTab = match?.matchType !== 'Promo';
  const expandLabel =
    match?.matchType === 'Promo'
      ? 'Show segment recap'
      : showStatsTab
        ? 'Show match summary & statistics'
        : 'Show match summary';

  const detailsOpen = !viewportNarrow || mobileLongOpen;

  return (
    <div
      className={`match-card-tabs${detailsOpen ? ' match-card-tabs--open' : ''}`}
      onClick={(e) => e.stopPropagation()}
      style={
        standalone
          ? { width: '100%' }
          : { marginTop: 12, paddingTop: 12, borderTop: '1px solid #444', width: '100%' }
      }
    >
      <button
        type="button"
        className="match-card-tabs__mobile-toggle"
        style={{ display: viewportNarrow ? "flex" : "none" }}
        aria-expanded={detailsOpen}
        onClick={toggleMobileLong}
      >
        {detailsOpen ? 'Hide details' : expandLabel}
      </button>
      <div
        className="match-card-tabs__collapsible"
        style={
          !detailsOpen
            ? { display: "none" }
            : { display: "block", marginTop: viewportNarrow ? 8 : 0 }
        }
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
          <button type="button" onClick={() => setCardView('summary')} style={cardView === 'summary' ? pillActive : pillBase}>
            Summary
          </button>
          {showStatsTab && (
            <button
              type="button"
              onClick={() => setCardView('statistics')}
              title="Last 5 matches: Win / Draw / Loss"
              style={cardView === 'statistics' ? pillActive : pillBase}
            >
              Statistics
            </button>
          )}
        </div>
        {cardView != null && (
          <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 12, minHeight: 48, width: '100%' }}>
          {cardView === 'summary' && (
            <div>
              <div style={{ color: '#C6A04F', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                {match?.matchType === 'Promo' ? 'Segment recap' : 'Summary'}
              </div>
              {royalRumbleHighlights && (
                <div style={{ marginBottom: 12, padding: '10px 12px', background: '#1a1a1a', borderRadius: 8, border: '1px solid #C6A04F' }}>
                  <div style={{ fontSize: 13, color: '#ccc', marginBottom: 4 }}>
                    <span style={{ color: '#C6A04F', fontWeight: 600 }}>Winner:</span>{' '}
                    {royalRumbleHighlights.winner ? (
                      <Link to={toProfile(royalRumbleHighlights.winner)} onClick={(e) => e.stopPropagation()} style={{ color: '#ccc', textDecoration: 'none' }}>
                        {wrestlerMap[royalRumbleHighlights.winner]?.name || royalRumbleHighlights.winner}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </div>
                  {royalRumbleHighlights.mostEliminations && (
                    <div style={{ fontSize: 13, color: '#ccc', marginBottom: 4 }}>
                      <span style={{ color: '#C6A04F', fontWeight: 600 }}>Most Eliminations:</span>{' '}
                      {royalRumbleHighlights.mostEliminations.map((w, i) => (
                        <span key={w.slug}>
                          {i > 0 && ' & '}
                          <Link to={toProfile(w.slug)} onClick={(e) => e.stopPropagation()} style={{ color: '#ccc', textDecoration: 'none' }}>
                            {wrestlerMap[w.slug]?.name || w.slug}
                          </Link>
                        </span>
                      ))}{' '}
                      ({royalRumbleHighlights.mostEliminations[0].count})
                    </div>
                  )}
                  {royalRumbleHighlights.ironman && (
                    <div style={{ fontSize: 13, color: '#ccc' }}>
                      <span style={{ color: '#C6A04F', fontWeight: 600 }}>Ironman/Ironwoman:</span>{' '}
                      <Link to={toProfile(royalRumbleHighlights.ironman.slug)} onClick={(e) => e.stopPropagation()} style={{ color: '#ccc', textDecoration: 'none' }}>
                        {wrestlerMap[royalRumbleHighlights.ironman.slug]?.name || royalRumbleHighlights.ironman.slug}
                      </Link>
                      {royalRumbleHighlights.ironman.time && ` (${royalRumbleHighlights.ironman.time})`}
                    </div>
                  )}
                </div>
              )}
              <div style={{ color: '#ccc', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {summaryContent || (match?.matchType === 'Promo' ? 'No recap added.' : 'No summary added for this match.')}
              </div>
            </div>
          )}
          {cardView === 'statistics' && (
            <div>
              {!events ? (
                <div style={{ color: '#888', fontSize: 13 }}>Event data is needed to show wrestler statistics.</div>
              ) : !shouldShowLastFiveStats(match) ? (
                <div style={{ color: '#888', fontSize: 13 }}>
                  Last-5 record is not shown for matches with many participants (e.g. Royal Rumble, Battle Royals, Survivor Series, War Games, Elimination Chamber).
                </div>
              ) : statisticsExtraHint ? (
                <div style={{ color: '#aaa', fontSize: 13, lineHeight: 1.5 }}>{statisticsExtraHint}</div>
              ) : (
                <div style={{ color: '#888', fontSize: 13, lineHeight: 1.5 }}>
                  Win / draw / loss boxes for the last five matches are shown next to each competitor on this card.
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
