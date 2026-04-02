'use client';

import React, { useCallback, useMemo } from 'react';
import { useNavigate, Link } from '@/components/boxscore-port/router-bridge';
import BeltIcon from './BeltIcon';
import BriefcaseIcon from './BriefcaseIcon';
import CrownIcon from './CrownIcon';
import TrophyIcon from './TrophyIcon';
import ChamberIcon from './ChamberIcon';
import WarGamesIcon from './WarGamesIcon';
import SurvivorIcon from './SurvivorIcon';
import countries from './data/countries';
import {
  extractWrestlerSlugs,
  getMatchOutcome,
  getLastMatchesForWrestler,
  shouldShowLastFiveStats,
} from './utils/matchOutcomes';
import { buildEventResultsSlug, eventResultsHref } from '@/lib/event-results/eventResultsRoute';
import MatchCardTabsSection from './MatchCardTabsSection';

// Helper functions
function getSpecialWinnerIcon(specialWinnerType) {
  switch (specialWinnerType) {
    case "Women's Money in the Bank winner":
    case "Men's Money in the Bank winner":
      return <BriefcaseIcon size={32} />;
    case "King of the Ring winner":
    case "Queen of the Ring winner":
      return <CrownIcon size={32} />;
    case "Men's Royal Rumble winner":
    case "Women's Royal Rumble winner":
      return <TrophyIcon size={32} />;
    case "Men's Elimination Chamber winner":
    case "Women's Elimination Chamber winner":
      return <ChamberIcon size={32} />;
    case "Men's War Games winner":
    case "Women's War Games winner":
      return <WarGamesIcon size={32} />;
    case "Men's Ultimate Survivor":
    case "Women's Ultimate Survivor":
      return <SurvivorIcon size={32} />;
    default:
      return null;
  }
}

function getCountryForNationality(nationality) {
  if (!nationality) return null;
  return countries.find((c) => c.name === nationality) || null;
}

function calculateAgeFromDob(dob) {
  if (!dob) return null;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age;
}

function renderWrestlerMeta(wrestler) {
  if (!wrestler) return null;
  const country = getCountryForNationality(wrestler.nationality);
  const age = calculateAgeFromDob(wrestler.dob);
  return (
    <div style={{ fontSize: 11, color: '#bbb', marginTop: 2, textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
        {(country || wrestler.nationality) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {country && country.flagImage && (
              <img
                src={country.flagImage}
                alt={wrestler.nationality || country.name}
                style={{ width: 18, height: 13, objectFit: 'cover', borderRadius: 2, boxShadow: '0 0 2px #000' }}
              />
            )}
            {!country?.flagImage && country?.flag && <span>{country.flag}</span>}
            {wrestler.nationality && <span>{wrestler.nationality}</span>}
          </span>
        )}
        {age !== null && (
          <span>
            Age {age}
          </span>
        )}
      </div>
    </div>
  );
}

const getTeams = (participants) => {
  if (Array.isArray(participants)) {
    return participants;
  }
  if (typeof participants === 'string') {
    return participants.split(' vs ').map(s => s.trim());
  }
  return [];
};

const parseTeamString = (teamStr, wrestlerMap = {}) => {
  if (!teamStr) {
    return { teamName: '', slugs: [] };
  }
  
  const teamMatch = teamStr.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (teamMatch) {
    const teamName = teamMatch[1].trim();
    const potentialSlugs = teamMatch[2].split('&').map(s => s.trim());
    // Convert display names to slugs if needed
    const slugs = potentialSlugs.map(potentialSlug => {
      // If it's already a slug (contains hyphen and lowercase), use it
      if (wrestlerMap[potentialSlug]) {
        return potentialSlug;
      }
      // Otherwise, try to find by name
      const found = Object.values(wrestlerMap).find(w => w.name === potentialSlug || w.id === potentialSlug);
      return found ? found.id : potentialSlug;
    });
    return { teamName, slugs };
  }
  const potentialSlugs = teamStr.split('&').map(s => s.trim());
  // Convert display names to slugs if needed
  const slugs = potentialSlugs.map(potentialSlug => {
    // If it's already a slug (contains hyphen and lowercase), use it
    if (wrestlerMap[potentialSlug]) {
      return potentialSlug;
    }
    // Otherwise, try to find by name
    const found = Object.values(wrestlerMap).find(w => w.name === potentialSlug || w.id === potentialSlug);
    return found ? found.id : potentialSlug;
  });
  return { teamName: '', slugs };
};

// Helper function to get current champion slug for a title
const getCurrentChampionForTitle = (titleName) => {
  if (!titleName || titleName === 'None') return null;
  
  // Map of title names to current champion slugs (from ChampionshipsPage.jsx)
  const titleToChampion = {
    'WWE Championship': 'cody-rhodes',
    'Undisputed WWE Championship': 'cody-rhodes',
    'World Heavyweight Championship': 'seth-rollins',
    "Men's United States Championship": 'sami-zayn',
    "Men's U.S. Championship": 'sami-zayn',
    "Men's Intercontinental Championship": 'dominik-mysterio',
    "Men's IC Championship": 'dominik-mysterio',
    'RAW Tag Team Championship': 'the-judgment-day',
    'Raw Tag Team Championship': 'the-judgment-day',
    'SmackDown Tag Team Championship': 'the-wyatt-sicks',
    "WWE Women's Championship": 'tiffany-stratton',
    "Women's World Championship": 'vacant',
    "Women's Intercontinental Championship": 'becky-lynch',
    "Women's IC Championship": 'becky-lynch',
    "Women's United States Championship": 'giulia',
    "Women's U.S. Championship": 'giulia',
    "Women's Tag Team Championship": 'charlotte-flair-alexa-bliss',
  };
  
  return titleToChampion[titleName] || null;
};

const pillBase = { padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '2px solid #C6A04F', cursor: 'pointer', background: 'transparent', color: '#C6A04F' };
const pillActive = { ...pillBase, background: '#C6A04F', color: '#232323' };
const pillDisabled = { ...pillBase, opacity: 0.5, cursor: 'not-allowed' };

const OUTCOME_COLORS = { W: '#2e7d32', D: '#f9a825', L: '#c62828' };

function LastFiveBoxes({ outcomes, size = 24 }) {
  if (!outcomes || outcomes.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6 }}>
      {outcomes.map((outcome, i) => (
        <div
          key={i}
          title={outcome === 'W' ? 'Win' : outcome === 'D' ? 'Draw' : 'Loss'}
          style={{
            width: size,
            height: size,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.45,
            fontWeight: 700,
            color: '#fff',
            background: OUTCOME_COLORS[outcome] || '#555',
          }}
        >
          {outcome}
        </div>
      ))}
    </div>
  );
}

/** Draftastic: fantasy total (+N in green) and scoring breakdown (white italic) under wrestler / belt. */
function FantasyPtsLine({ slug, fantasyPointsBySlug, marginTop = 4, compact = false }) {
  if (!fantasyPointsBySlug || slug == null || String(slug).trim() === '') return null;
  const row = fantasyPointsBySlug[slug];
  if (row == null) return null;
  const pts = Number(row.points);
  if (Number.isNaN(pts)) return null;
  const breakdown = Array.isArray(row.breakdown) ? row.breakdown.filter((x) => typeof x === 'string' && String(x).trim()) : [];
  const totalLabel = pts >= 0 ? `+${pts}` : String(pts);
  const tip = breakdown.length > 0 ? breakdown.join('\n') : undefined;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop,
        textAlign: 'center',
        lineHeight: 1.25,
        maxWidth: compact ? 56 : 160,
      }}
      title={compact ? tip : undefined}
    >
      <div
        style={{
          fontSize: compact ? 11 : 12,
          color: '#4CAF50',
          fontWeight: row.isWinner ? 800 : 700,
          letterSpacing: 0.02,
        }}
      >
        {totalLabel}
      </div>
      {!compact && breakdown.length > 0 && (
        <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          {breakdown.map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: 9,
                color: '#fff',
                fontStyle: 'italic',
                fontWeight: 400,
                lineHeight: 1.3,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * PWBS-style tag side: avatar row, team title + italic roster (or bold names if no team), compact fantasy row.
 * Full per-line fantasy breakdown is in each +N tooltip (hover) so the card stays visually clean like PWBS.
 */
function TagTeamPartnerNamesAndFantasyGrid({
  slugs,
  teamName = null,
  suppressTeamTitle = false,
  wrestlerMap,
  wrestlerTo,
  nameColor,
  nameFontSize,
  nameFontWeight = 600,
  fantasyPointsBySlug,
  avatarSize = null,
  avatarBorder = '1px solid #666',
  belowAvatar = null,
  style,
}) {
  if (!slugs || slugs.length < 2) return null;
  const showAvatars = avatarSize != null;
  const av = showAvatars ? avatarSize : 0;
  const titleLineSize = nameFontWeight >= 700 ? 20 : 18;
  const memberItalicSize = Math.max(13, nameFontSize);

  return (
    <div style={{ width: '100%', maxWidth: 440, ...style }}>
      {showAvatars ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 4,
            justifyContent: 'center',
            alignItems: 'flex-start',
            marginBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          {slugs.map((slug, i) => (
            <div key={`av-${slug || i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Link to={wrestlerTo(slug)} onClick={(e) => e.stopPropagation()} style={{ display: 'block', lineHeight: 0 }}>
                <div
                  style={{
                    width: av,
                    height: av,
                    borderRadius: '50%',
                    background: '#444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: av * 0.6,
                    color: '#7da2c1',
                    border: avatarBorder,
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  {wrestlerMap[slug]?.image_url ? (
                    <img
                      src={wrestlerMap[slug].image_url}
                      alt={wrestlerMap[slug].name}
                      style={{ width: av, height: av, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span role="img" aria-label="wrestler">&#128100;</span>
                  )}
                </div>
              </Link>
              {typeof belowAvatar === 'function' ? belowAvatar(slug, i) : null}
            </div>
          ))}
        </div>
      ) : null}
      <span
        style={{
          fontWeight: 700,
          color: nameColor,
          fontSize: nameFontSize,
          textAlign: 'center',
          marginBottom: 2,
          display: 'block',
          width: '100%',
        }}
      >
        {teamName && !suppressTeamTitle ? (
          <>
            <div style={{ fontSize: titleLineSize, fontWeight: 800, color: nameColor }}>{teamName}</div>
            <div style={{ fontSize: memberItalicSize, color: '#bbb', fontStyle: 'italic', marginTop: 2 }}>
              {slugs.map((slug, i) => (
                <React.Fragment key={slug}>
                  <Link to={wrestlerTo(slug)} onClick={(e) => e.stopPropagation()} style={{ color: '#bbb', textDecoration: 'none' }}>
                    {wrestlerMap[slug]?.name || slug}
                  </Link>
                  {i < slugs.length - 1 ? ' & ' : ''}
                </React.Fragment>
              ))}
            </div>
          </>
        ) : teamName && suppressTeamTitle ? (
          <div style={{ fontSize: memberItalicSize, color: '#bbb', fontStyle: 'italic' }}>
            {slugs.map((slug, i) => (
              <React.Fragment key={slug}>
                <Link to={wrestlerTo(slug)} onClick={(e) => e.stopPropagation()} style={{ color: '#bbb', textDecoration: 'none' }}>
                  {wrestlerMap[slug]?.name || slug}
                </Link>
                {i < slugs.length - 1 ? ' & ' : ''}
              </React.Fragment>
            ))}
          </div>
        ) : (
          slugs.map((slug, i) => (
            <React.Fragment key={slug}>
              <Link
                to={wrestlerTo(slug)}
                onClick={(e) => e.stopPropagation()}
                style={{ color: nameColor, textDecoration: 'none', fontWeight: nameFontWeight, fontSize: nameFontSize }}
              >
                {wrestlerMap[slug]?.name || slug}
              </Link>
              {i < slugs.length - 1 ? ' & ' : ''}
            </React.Fragment>
          ))
        )}
      </span>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 10,
          marginTop: 6,
          width: '100%',
        }}
      >
        {slugs.map((slug) => (
          <FantasyPtsLine key={`fp-${slug}`} slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} compact marginTop={0} />
        ))}
      </div>
    </div>
  );
}

export default function MatchCard({ match, event, wrestlerMap, isClickable = true, matchIndex, events, fantasyPointsBySlug = null }) {
  const navigate = useNavigate();
  const [expandedSlug, setExpandedSlug] = React.useState(null);
  const [showRumbleDetails, setShowRumbleDetails] = React.useState(false);
  const hasSummary = !!(match?.summary || (match?.matchType === 'Promo' && match?.notes));
  const [cardView, setCardView] = React.useState(() => (hasSummary ? 'summary' : null));
  const hasCommentary = Array.isArray(match?.commentary) && match.commentary.length > 0;
  const summaryContent = match?.matchType === 'Promo' ? (match?.notes || '') : (match?.summary || '');

  const showStatsLastFive = useMemo(
    () => events && match && shouldShowLastFiveStats(match),
    [events, match]
  );
  const statsParticipantData = useMemo(() => {
    if (!showStatsLastFive || !events || !match || !wrestlerMap) return [];
    const slugs = [...extractWrestlerSlugs(match.participants)];
    const priorToMatch =
      event?.id != null && (matchIndex != null || match?.order != null)
        ? { eventId: event.id, matchIndex, matchOrder: match?.order }
        : undefined;
    return slugs.map((slug) => {
      const lastFive = getLastMatchesForWrestler(events, slug, 5, {
        wrestlerMap,
        priorToMatch,
      });
      const outcomes = lastFive.map(({ match: m }) => getMatchOutcome(m, slug, wrestlerMap));
      return { slug, name: wrestlerMap[slug]?.name || slug, imageUrl: wrestlerMap[slug]?.image_url, outcomes };
    });
  }, [showStatsLastFive, events, match, wrestlerMap, event?.id, matchIndex, match?.order]);
  // Show custom stipulation text (e.g. "Three Stages of Hell") instead of "Custom/Other" on the card
  const displayStipulation = (match?.stipulation === 'Custom/Other' && (match?.customStipulation || '').trim())
    ? match.customStipulation.trim()
    : (match?.stipulation || '');

  // Royal Rumble highlights for Summary tab (Winner, Most Eliminations, Ironman)
  const royalRumbleHighlights = useMemo(() => {
    if (match?.matchType !== 'Royal Rumble') return null;
    const { entryOrder = [], eliminations = [], manualIronman } = match.royalRumbleData || {};
    const parseTime = (s) => {
      if (!s) return 0;
      const p = s.split(':');
      return p.length === 2 ? parseInt(p[0], 10) * 60 + parseInt(p[1], 10) : 0;
    };
    const formatTime = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
    const participantStats = {};
    entryOrder.forEach(entry => {
      const entrySeconds = parseTime(entry.entryTime);
      const official = entry.timeInRing ? parseTime(entry.timeInRing) : null;
      participantStats[entry.slug] = { entrySeconds, eliminationSeconds: null, timeInRumble: official, eliminations: 0 };
    });
    // Include everyone from eliminations so we can count eliminations even without entry order
    eliminations.forEach(elim => {
      [elim.eliminatedBy, elim.eliminatedBy2, elim.eliminated].filter(Boolean).forEach(slug => {
        if (!participantStats[slug]) participantStats[slug] = { entrySeconds: 0, eliminationSeconds: null, timeInRumble: null, eliminations: 0 };
      });
    });
    const hasOfficialTimes = entryOrder.some(e => !!e.timeInRing);
    eliminations.forEach(elim => {
      if (elim.eliminated && elim.time) {
        const es = parseTime(elim.time);
        if (participantStats[elim.eliminated]) {
          const st = participantStats[elim.eliminated];
          st.eliminationSeconds = es;
          if (st.timeInRumble == null && st.entrySeconds != null) st.timeInRumble = es - st.entrySeconds;
        }
      }
      if (elim.eliminatedBy && participantStats[elim.eliminatedBy]) participantStats[elim.eliminatedBy].eliminations++;
      if (elim.eliminatedBy2 && participantStats[elim.eliminatedBy2]) participantStats[elim.eliminatedBy2].eliminations++;
    });
    if (match.winner && participantStats[match.winner] && match.time) {
      const st = participantStats[match.winner];
      if (st.timeInRumble == null && !st.eliminationSeconds) st.timeInRumble = parseTime(match.time) - st.entrySeconds;
    }
    let ironman = null;
    let maxT = -1;
    Object.entries(participantStats).forEach(([slug, st]) => {
      if (st.timeInRumble != null && st.timeInRumble > maxT) {
        maxT = st.timeInRumble;
        ironman = { slug, time: formatTime(st.timeInRumble) };
      }
    });
    if (!hasOfficialTimes && manualIronman && participantStats[manualIronman]) {
      const st = participantStats[manualIronman];
      ironman = { slug: manualIronman, time: st.timeInRumble != null ? formatTime(st.timeInRumble) : null };
    }
    let mostEliminations = [];
    let maxE = -1;
    Object.entries(participantStats).forEach(([slug, st]) => {
      if (st.eliminations > maxE) { maxE = st.eliminations; mostEliminations = [{ slug, count: st.eliminations }]; }
      else if (st.eliminations === maxE && maxE > 0) mostEliminations.push({ slug, count: st.eliminations });
    });
    return {
      winner: match.winner || null,
      mostEliminations: mostEliminations.length > 0 && mostEliminations[0].count > 0 ? mostEliminations : null,
      ironman: ironman && (ironman.time || participantStats[ironman?.slug]?.timeInRumble != null) ? ironman : null
    };
  }, [match]);

  // Create handler inline to ensure correct closure capture
  // Use matchIndex (array index) for navigation - it's more reliable than order
  const eventId = event?.id;
  const eventResultsPath = event ? eventResultsHref(event) : '';
  const eventResultsSlugSegment = event ? buildEventResultsSlug(event) : '';
  // matchIndex is 0-based, but we'll use 1-based for URL (1, 2, 3...)
  const navigationIndex = matchIndex !== undefined ? matchIndex + 1 : (match?.order || 1);

  // Pass event/match context when linking to wrestler profile so profile can show "Back to event" / "Back to match"
  const wrestlerLinkState = React.useMemo(
    () => (eventId ? { fromEvent: eventId, fromEventSlug: eventResultsSlugSegment, eventName: event?.name || 'Event', matchOrder: navigationIndex } : null),
    [eventId, eventResultsSlugSegment, event?.name, navigationIndex]
  );
  const wrestlerTo = React.useCallback(
    (slugOrId) => (slugOrId ? { pathname: `/wrestlers/${slugOrId}`, state: wrestlerLinkState || {} } : '/wrestlers'),
    [wrestlerLinkState]
  );

  const handleClick = React.useCallback((e) => {
    if (!isClickable || !eventResultsPath || navigationIndex == null) {
      return;
    }
    
    // Prevent event bubbling
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    navigate(`${eventResultsPath}?match=${navigationIndex}`);
  }, [isClickable, eventResultsPath, navigationIndex, navigate]);

  const isMatchInProgress = event?.status === 'live' && match?.isLive;

  // Early return for 2 out of 3 Falls
  if (match.matchType === '2 out of 3 Falls' && typeof match.participants === 'string') {
    const participantStrings = match.participants.split(' vs ').map(s => s.trim());
    const participant1 = participantStrings[0];
    const participant2 = participantStrings[1];
    const falls = [];
    
    if (match.result) {
      let resultParts = match.result.split(' → ');
      if (resultParts.length === 1) {
        resultParts = match.result.split(' -> ');
      }
      falls.push(...resultParts);
    }
    
    if (falls.length === 1 && falls[0].includes(' def. ')) {
      const finalResult = falls[0];
      const winner = finalResult.split(' def. ')[0];
      const loser = finalResult.split(' def. ')[1];
      
      falls.length = 0;
      falls.push(`${loser} def. ${winner}`);
      falls.push(`${winner} def. ${loser}`);
      falls.push(finalResult);
    }
    
    let overallWinner = null;
    if (falls.length > 0) {
      const lastFall = falls[falls.length - 1];
      if (lastFall.includes(' def. ')) {
        overallWinner = lastFall.split(' def. ')[0];
      }
    }
    
    return (
      <div
        onClick={(e) => {
          if (isClickable && eventResultsPath && navigationIndex != null) {
            e.preventDefault();
            e.stopPropagation();
            navigate(`${eventResultsPath}?match=${navigationIndex}`);
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#232323',
          borderRadius: 12,
          boxShadow: '0 0 12px #C6A04F22',
          padding: '18px 24px',
          cursor: isClickable ? 'pointer' : 'default',
          border: match.cardType === 'Main Event' ? '2px solid #C6A04F' : '1px solid #444',
          position: 'relative',
          minHeight: 120,
          marginBottom: 2,
          transition: 'background 0.2s',
          zIndex: 1,
        }}
      >
        {match.cardType === 'Main Event' && (
          <div style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#C6A04F',
            color: '#000',
            padding: '4px 16px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 10,
          }}>
            Main Event
          </div>
        )}

        <div style={{
          color: '#C6A04F',
          fontWeight: 700,
          fontSize: 15,
          marginBottom: 8,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {[match.matchType, displayStipulation !== 'None' ? displayStipulation : null, match.title && match.title !== 'None' ? match.title : null].filter(Boolean).join(' — ')}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#C6A04F', fontSize: 15, marginBottom: 2, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
            {match.cardType}{match.title && match.title !== 'None' && match.stipulation !== 'No. 1 Contender Match' ? ' - Title Match' : ''}
          </div>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: 20, marginBottom: 2, textAlign: 'center' }}>
            {isMatchInProgress ? (
              <span style={{ color: '#27ae60' }}>MATCH IN PROGRESS</span>
            ) : (
              match.result && match.result !== 'No winner' ? 'Final' : match.result
            )}
          </div>
          <div style={{ color: '#bbb', fontSize: 15, marginBottom: 2, textAlign: 'center' }}>{match.method}</div>
          <div style={{ color: '#bbb', fontSize: 15, textAlign: 'center' }}>{match.time}</div>
        </div>
        
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          {falls.map((fall, index) => {
            let fallWinner = null;
            if (fall.includes(' def. ')) {
              fallWinner = fall.split(' def. ')[0];
            }
            
            const participant1IsWinner = fallWinner === wrestlerMap[participant1]?.name || fallWinner === participant1;
            const participant2IsWinner = fallWinner === wrestlerMap[participant2]?.name || fallWinner === participant2;
            
            return (
              <div key={index} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 12,
                  background: '#2a2a2a',
                  borderRadius: 8,
                  border: '1px solid #444',
                  minWidth: 160,
                  minHeight: 80,
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Link to={wrestlerTo(participant1)} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                      <img
                        src={wrestlerMap[participant1]?.image_url || '/images/placeholder.png'}
                        alt={wrestlerMap[participant1]?.name || participant1}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: participant1IsWinner ? '2px solid #C6A04F' : '2px solid #666',
                        }}
                      />
                      <span style={{
                        fontSize: 11,
                        color: participant1IsWinner ? '#C6A04F' : '#fff',
                        fontWeight: participant1IsWinner ? 'bold' : 'normal',
                        textAlign: 'center',
                        maxWidth: 70,
                      }}>
                        {wrestlerMap[participant1]?.name || participant1}
                      </span>
                    </Link>
                    <FantasyPtsLine slug={participant1} fantasyPointsBySlug={fantasyPointsBySlug} />
                  </div>
                  
                  <div style={{ color: '#C6A04F', fontSize: 13, fontWeight: 'bold' }}>vs</div>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Link to={wrestlerTo(participant2)} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                      <img
                        src={wrestlerMap[participant2]?.image_url || '/images/placeholder.png'}
                        alt={wrestlerMap[participant2]?.name || participant2}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: participant2IsWinner ? '2px solid #C6A04F' : '2px solid #666',
                        }}
                      />
                      <span style={{
                        fontSize: 11,
                        color: participant2IsWinner ? '#C6A04F' : '#fff',
                        fontWeight: participant2IsWinner ? 'bold' : 'normal',
                        textAlign: 'center',
                        maxWidth: 70,
                      }}>
                        {wrestlerMap[participant2]?.name || participant2}
                      </span>
                    </Link>
                    <FantasyPtsLine slug={participant2} fantasyPointsBySlug={fantasyPointsBySlug} />
                  </div>
                </div>
                
                <div style={{
                  color: '#C6A04F',
                  fontWeight: 700,
                  fontSize: 13,
                  textAlign: 'center',
                }}>
                  Fall {index + 1}
                </div>
              </div>
            );
          })}
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            color: '#C6A04F',
            fontSize: 20,
            fontWeight: 'bold',
          }}>
            →
          </div>
          
          {overallWinner && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: 16,
                background: '#2a2a2a',
                borderRadius: 8,
                border: '2px solid #C6A04F',
                minWidth: 160,
                minHeight: 120,
              }}>
                <div style={{
                  color: '#C6A04F',
                  fontWeight: 800,
                  fontSize: 16,
                  textAlign: 'center',
                  marginBottom: 8,
                }}>
                  WINNER
                </div>
                <Link to={wrestlerTo(overallWinner)} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                  <img
                    src={wrestlerMap[overallWinner]?.image_url || '/images/placeholder.png'}
                    alt={overallWinner}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #C6A04F',
                      marginBottom: 8,
                    }}
                  />
                  <span style={{
                    fontSize: 14,
                    color: '#C6A04F',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    maxWidth: 80,
                  }}>
                    {wrestlerMap[overallWinner]?.name || overallWinner}
                  </span>
                </Link>
                <FantasyPtsLine slug={overallWinner} fantasyPointsBySlug={fantasyPointsBySlug} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Early return for multi-team matches (6-team Tag Team, 5-team Tag Team, 4-way Tag Team, etc.)
  if (match.matchType === '6-team Tag Team' || match.matchType === '5-team Tag Team' || match.matchType === '4-way Tag Team' || match.matchType === '3-way Tag Team') {
    let teamStrings = [];
    if (typeof match.participants === 'string') {
      teamStrings = match.participants.split(' vs ').map(s => s.trim());
    } else if (Array.isArray(match.participants)) {
      // For array format, each element represents a team
      teamStrings = match.participants;
    }
    const winner = match.result && match.result.includes(' def. ')
      ? match.result.split(' def. ')[0]
      : (match.result ? match.result : '');
    
    function normalize(str) {
      return (str || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    }
    
    let winnerIndex = -1;
    teamStrings.forEach((teamStr, idx) => {
      const { teamName, slugs } = parseTeamString(teamStr, wrestlerMap);
      const individualNames = slugs.map(slug => wrestlerMap[slug]?.name || slug).join(' & ');
      
      if (teamName && normalize(winner) === normalize(teamName)) {
        winnerIndex = idx;
      } else if (normalize(winner) === normalize(individualNames)) {
        winnerIndex = idx;
      } else if (normalize(winner) === normalize(teamStr)) {
        winnerIndex = idx;
      }
    });
    
    const isTitleMatch = match.title && match.title !== 'None' && match.stipulation !== 'No. 1 Contender Match';
    const shouldShowBeltIcon = isTitleMatch && match.titleOutcome !== 'No. 1 Contender';
    let championIndex = winnerIndex;
    
    // If "Champion Retains" is selected and defendingChampion is set, find which participant is the defending champion
    if (match.titleOutcome === 'Champion Retains' && match.defendingChampion) {
      const defendingChampion = match.defendingChampion.trim();
      teamStrings.forEach((teamStr, idx) => {
        const { teamName, slugs } = parseTeamString(teamStr, wrestlerMap);
        const individualNames = slugs.map(slug => wrestlerMap[slug]?.name || slug).join(' & ');
        
        // Check if defending champion matches team name
        if (teamName && normalize(defendingChampion) === normalize(teamName)) {
          championIndex = idx;
        }
        // Check if defending champion matches individual names
        else if (normalize(defendingChampion) === normalize(individualNames)) {
          championIndex = idx;
        }
        // Check if defending champion matches the full team string
        else if (normalize(defendingChampion) === normalize(teamStr)) {
          championIndex = idx;
        }
      });
    } else {
      // For title matches, the winner should always be the champion
      // Whether they're retaining or becoming a new champion, show belt on the winner
      championIndex = winnerIndex;
    }
    
    return (
      <div
        onClick={(e) => {
          if (isClickable && eventResultsPath && navigationIndex != null) {
            e.preventDefault();
            e.stopPropagation();
            navigate(`${eventResultsPath}?match=${navigationIndex}`);
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#232323',
          borderRadius: 12,
          boxShadow: '0 0 12px #C6A04F22',
          padding: '18px 24px',
          cursor: isClickable ? 'pointer' : 'default',
          border: match.cardType === 'Main Event' ? '2px solid #C6A04F' : '1px solid #444',
          transition: 'background 0.2s',
          position: 'relative',
          minHeight: 120,
          marginBottom: 2,
          zIndex: 1,
        }}
      >
        {match.cardType === 'Main Event' && (
          <div style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#C6A04F',
            color: '#000',
            padding: '4px 16px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 10,
          }}>
            Main Event
          </div>
        )}
        
        {match.matchType === 'Cash In Match' && (
          <div style={{
            position: 'absolute',
            top: -10,
            right: 10,
            background: '#27ae60',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span role="img" aria-label="briefcase">💼</span>
            Cash In
          </div>
        )}
        
        <div style={{
          color: '#C6A04F',
          fontWeight: 700,
          fontSize: 15,
          marginBottom: 8,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {[match.matchType, displayStipulation !== 'None' ? displayStipulation : null, match.title && match.title !== 'None' ? match.title : null].filter(Boolean).join(' — ')}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#C6A04F', fontSize: 15, marginBottom: 2, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
            {match.cardType}{match.title && match.title !== 'None' && match.stipulation !== 'No. 1 Contender Match' ? ' - Title Match' : ''}
          </div>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: 20, marginBottom: 2, textAlign: 'center' }}>
            {isMatchInProgress ? (
              <span style={{ color: '#27ae60' }}>MATCH IN PROGRESS</span>
            ) : (
              match.result && match.result !== 'No winner' ? 'Final' : match.result
            )}
          </div>
          <div style={{ color: '#bbb', fontSize: 15, marginBottom: 2, textAlign: 'center' }}>{match.method}</div>
          <div style={{ color: '#bbb', fontSize: 15, textAlign: 'center' }}>{match.time}</div>
        </div>
        
        {/* Multi-team grid layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: match.matchType === '6-team Tag Team' 
            ? 'repeat(3, 1fr)' 
            : match.matchType === '5-team Tag Team'
            ? 'repeat(5, 1fr)'
            : 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '12px',
          justifyContent: 'center',
          marginBottom: 16,
          maxWidth: '100%',
        }}>
          {teamStrings.map((teamStr, sideIdx) => {
            const { teamName, slugs } = parseTeamString(teamStr, wrestlerMap);
            return (
              <div key={sideIdx} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                padding: '8px',
                background: winnerIndex === sideIdx ? '#2a2a2a' : '#1a1a1a',
                borderRadius: '8px',
                border: winnerIndex === sideIdx ? '2px solid #C6A04F' : '1px solid #444',
                minWidth: '100px',
              }}>
                {teamName && (
                  <div style={{ fontSize: '14px', fontWeight: 800, color: winnerIndex === sideIdx ? '#C6A04F' : '#fff', textAlign: 'center', marginBottom: slugs.length > 1 ? 8 : 6 }}>
                    {teamName}
                  </div>
                )}
                {slugs.length > 1 ? (
                  <TagTeamPartnerNamesAndFantasyGrid
                    teamName={teamName}
                    suppressTeamTitle={!!teamName}
                    slugs={slugs}
                    wrestlerMap={wrestlerMap}
                    wrestlerTo={wrestlerTo}
                    nameColor={winnerIndex === sideIdx ? '#C6A04F' : '#fff'}
                    nameFontSize={11}
                    nameFontWeight={600}
                    fantasyPointsBySlug={fantasyPointsBySlug}
                    avatarSize={40}
                    avatarBorder={winnerIndex === sideIdx ? '2px solid #C6A04F' : '1px solid #666'}
                    style={{ marginBottom: 6 }}
                  />
                ) : (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    {slugs.map((slug, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 80 }}>
                        <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ display: 'block', lineHeight: 0 }}>
                          <div style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: '50%', 
                            background: '#444', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '24px', 
                            color: '#7da2c1',
                            border: winnerIndex === sideIdx ? '2px solid #C6A04F' : '1px solid #666',
                          }}>
                            {wrestlerMap[slug]?.image_url
                              ? <img src={wrestlerMap[slug].image_url} alt={wrestlerMap[slug].name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                              : <span role="img" aria-label="wrestler">&#128100;</span>
                            }
                          </div>
                        </Link>
                        <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ color: winnerIndex === sideIdx ? '#C6A04F' : '#fff', textDecoration: 'none', fontSize: 11, fontWeight: 600, marginTop: 6, textAlign: 'center', lineHeight: 1.15 }}>
                          {wrestlerMap[slug]?.name || slug}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
                {shouldShowBeltIcon && championIndex === sideIdx && match.title?.includes('Tag Team Championship') && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
                    <BeltIcon size={24} />
                    {match.titleOutcome && match.titleOutcome !== 'None' && (
                      <div style={{ fontSize: 10, color: match.titleOutcome === 'New Champion' ? '#4CAF50' : '#FFC107', fontWeight: 600, marginTop: 2, textAlign: 'center' }}>{match.titleOutcome}</div>
                    )}
                  </div>
                )}
                {shouldShowBeltIcon && championIndex === sideIdx && !match.title?.includes('Tag Team Championship') && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
                    <BeltIcon size={28} />
                    {match.titleOutcome && match.titleOutcome !== 'None' && (
                      <div style={{ fontSize: 10, color: match.titleOutcome === 'New Champion' ? '#4CAF50' : '#FFC107', fontWeight: 600, marginTop: 2, textAlign: 'center' }}>{match.titleOutcome}</div>
                    )}
                  </div>
                )}
                {slugs.length === 1 ? <FantasyPtsLine slug={slugs[0]} fantasyPointsBySlug={fantasyPointsBySlug} /> : null}

                {winnerIndex === sideIdx && (
                  <div style={{ 
                    fontSize: '10px', 
                    color: '#C6A04F', 
                    fontWeight: 600, 
                    marginTop: '4px',
                    textAlign: 'center',
                  }}>
                    WINNER
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <MatchCardTabsSection
          match={match}
          event={event}
          wrestlerMap={wrestlerMap}
          events={events}
          matchIndex={matchIndex}
          royalRumbleHighlights={royalRumbleHighlights}
          wrestlerTo={wrestlerTo}
          summaryContent={summaryContent}
          hasSummary={hasSummary}
          hasCommentary={hasCommentary}
          cardView={cardView}
          setCardView={setCardView}
        />
      </div>
    );
  }

  // Parse participants
  const teams = getTeams(match.participants);
  let teamStrings = [];
  if (typeof match.participants === 'string' && match.participants) {
    if (match.matchType === 'Gauntlet Match' || match.matchType === 'Tag Team Gauntlet Match' || match.matchType === '2 out of 3 Falls') {
      teamStrings = match.participants.split(' → ').map(s => s.trim());
    } else {
      teamStrings = match.participants.split(' vs ').map(s => s.trim());
    }
  } else if (Array.isArray(match.participants)) {
    // For array format, each element represents a team
    teamStrings = match.participants;
  }
  
  const winner = match.result && match.result.includes(' def. ')
    ? match.result.split(' def. ')[0]
    : (match.result ? match.result : '');

  function normalize(str) {
    return (str || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
  
  let winnerIndex = -1;
  teamStrings.forEach((teamStr, idx) => {
    const { teamName, slugs } = parseTeamString(teamStr);
    const individualNames = slugs.map(slug => wrestlerMap[slug]?.name || slug).join(' & ');

    // Check if winner matches team name
    if (teamName && normalize(winner) === normalize(teamName)) {
      winnerIndex = idx;
    }
    // Check if winner matches individual names
    else if (normalize(winner) === normalize(individualNames)) {
      winnerIndex = idx;
    }
    // Check if winner matches the full team string (e.g., "TeamName (wrestler1 & wrestler2)")
    else if (normalize(winner) === normalize(teamStr)) {
      winnerIndex = idx;
    }
  });
  
  const isTitleMatch = match.title && match.title !== 'None' && match.stipulation !== 'No. 1 Contender Match';
  const shouldShowBeltIcon = isTitleMatch && match.titleOutcome !== 'No. 1 Contender';
  
  // Determine which team should show the belt icon
  let championIndex = winnerIndex;
  
  // If "Champion Retains" is selected and defendingChampion is set, find which participant is the defending champion
  if (match.titleOutcome === 'Champion Retains' && match.defendingChampion) {
    const defendingChampion = match.defendingChampion.trim();
    teamStrings.forEach((teamStr, idx) => {
      const { teamName, slugs } = parseTeamString(teamStr, wrestlerMap);
      const individualNames = slugs.map(slug => wrestlerMap[slug]?.name || slug).join(' & ');
      
      // Check if defending champion matches team name
      if (teamName && normalize(defendingChampion) === normalize(teamName)) {
        championIndex = idx;
      }
      // Check if defending champion matches individual names
      else if (normalize(defendingChampion) === normalize(individualNames)) {
        championIndex = idx;
      }
      // Check if defending champion matches the full team string
      else if (normalize(defendingChampion) === normalize(teamStr)) {
        championIndex = idx;
      }
    });
  } else {
    // For title matches, the winner should always be the champion
    // Whether they're retaining or becoming a new champion, show belt on the winner
    championIndex = winnerIndex;
  }
  
  const triangleRight = (
    <svg width="14" height="18" viewBox="0 0 8 16" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 8 }}>
      <polygon points="0,8 8,0 8,16" fill="#fff" />
    </svg>
  );
  const triangleLeft = (
    <svg width="14" height="18" viewBox="0 0 8 16" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }}>
      <polygon points="8,8 0,0 0,16" fill="#fff" />
    </svg>
  );
  const triangleDown = (
    <svg width="16" height="8" viewBox="0 0 16 8" style={{ display: 'block', margin: '0 auto 2px auto' }}>
      <polygon points="8,8 0,0 16,0" fill="#fff" />
    </svg>
  );
  
  let topLabel = '';
  const labelParts = [];
  
  if (match.matchType && match.matchType !== 'Singles Match' && match.matchType !== 'Promo') {
    labelParts.push(match.matchType);
  }
  
  if (displayStipulation && displayStipulation !== 'None' && match.matchType !== 'Promo') {
    labelParts.push(displayStipulation);
  }
  
  if (match.title && match.title !== 'None' && match.matchType !== 'Promo') {
    labelParts.push(match.title);
  }
  
  if (labelParts.length > 0) {
    topLabel = labelParts.join(' — ');
  }
  
  // Upcoming gauntlet (no progression/result): show as multi-way; otherwise use gauntlet progression UI
  const hasGauntletProgressionOrResult =
    (match.matchType === 'Gauntlet Match' || match.matchType === 'Tag Team Gauntlet Match') &&
    (() => {
      const hasProgression = match.gauntletProgression && match.gauntletProgression.length > 0 &&
        match.gauntletProgression.some(p => p && p.winner && p.method);
      const hasResult = match.result && String(match.result).trim();
      return !!(hasProgression || hasResult);
    })();
  const isMultiSide = teams.length > 2 ||
    ((match.matchType === 'Gauntlet Match' || match.matchType === 'Tag Team Gauntlet Match') &&
      typeof match.participants === 'string' &&
      match.participants.includes(' → ') &&
      !hasGauntletProgressionOrResult);
  const isTwoSide = teams.length === 2 && !isMultiSide;

  return (
    <div
      onClick={(e) => {
        if (isClickable && eventResultsPath && navigationIndex != null) {
          e.preventDefault();
          e.stopPropagation();
          navigate(`${eventResultsPath}?match=${navigationIndex}`);
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#232323',
        borderRadius: 12,
        boxShadow: '0 0 12px #C6A04F22',
        padding: '18px 24px',
        cursor: isClickable ? 'pointer' : 'default',
        border: match.cardType === 'Main Event' ? '2px solid #C6A04F' : '1px solid #444',
        transition: 'background 0.2s',
        position: 'relative',
        minHeight: 120,
        marginBottom: 2,
        zIndex: 1,
      }}
    >
      {match.cardType === 'Main Event' && (
        <div style={{
          position: 'absolute',
          top: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#C6A04F',
          color: '#000',
          padding: '4px 16px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 10,
        }}>
          Main Event
        </div>
      )}
      
      {topLabel && (
        <div style={{
          color: '#C6A04F',
          fontWeight: 700,
          fontSize: 15,
          marginBottom: 8,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {topLabel}
        </div>
      )}
      
      {(match.matchType === 'Gauntlet Match' || match.matchType === 'Tag Team Gauntlet Match') && typeof match.participants === 'string' && hasGauntletProgressionOrResult ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#C6A04F', fontSize: 15, marginBottom: 2, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
            {match.cardType}{match.title && match.title !== 'None' && match.stipulation !== 'No. 1 Contender Match' ? ' - Title Match' : ''}
          </div>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: 20, marginBottom: 2, textAlign: 'center' }}>
            {isMatchInProgress ? (
              <span style={{ color: '#27ae60' }}>MATCH IN PROGRESS</span>
            ) : (
              match.result && match.result !== 'No winner' ? 'Final' : match.result
            )}
          </div>
          <div style={{ color: '#bbb', fontSize: 15, marginBottom: 2, textAlign: 'center' }}>{match.method}</div>
          <div style={{ color: '#bbb', fontSize: 15, textAlign: 'center' }}>{match.time}</div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 16,
            width: '100%',
            maxWidth: 400,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            {(() => {
              const isTagGauntlet = match.matchType === 'Tag Team Gauntlet Match';
              const getPartDisplay = (str) => {
                if (!str) return '';
                if (str.includes(' & ')) return str.split('&').map(s => wrestlerMap[s.trim()]?.name || s.trim()).join(' & ');
                return wrestlerMap[str]?.name || str;
              };
              const firstSlug = (str) => (str && str.includes(' & ') ? str.split('&').map(s => s.trim())[0] : str) || '';
              const matches = [];
              let currentWinner = teamStrings[0];
              
              for (let i = 0; i < teamStrings.length - 1; i++) {
                const participant1 = currentWinner;
                const participant2 = teamStrings[i + 1];
                
                let winner = null;
                if (match.gauntletProgression && match.gauntletProgression[i]) {
                  const matchResult = match.gauntletProgression[i];
                  if (matchResult.winner) {
                    if (matchResult.winner === participant1) {
                      winner = getPartDisplay(participant1);
                      currentWinner = participant1;
                    } else if (matchResult.winner === participant2) {
                      winner = getPartDisplay(participant2);
                      currentWinner = participant2;
                    }
                  }
                }
                const disp1 = getPartDisplay(participant1);
                const disp2 = getPartDisplay(participant2);
                const winnerIs1 = winner === disp1;
                const winnerIs2 = winner === disp2;
               
                matches.push(
                  <div key={i} style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginLeft: i * 24,
                  }}>
                    <span style={{
                      color: '#C6A04F',
                      fontSize: 11,
                      fontWeight: 700,
                      minWidth: 52,
                    }}>
                      Match {i + 1}
                    </span>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      padding: 6,
                      background: '#2a2a2a',
                      borderRadius: 6,
                      border: '1px solid #444',
                      minWidth: isTagGauntlet ? 240 : 140,
                    }}>
                      {isTagGauntlet ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, maxWidth: 120 }}>
                          <span style={{ color: winnerIs1 ? '#C6A04F' : '#fff', fontWeight: winnerIs1 ? 'bold' : 'normal', fontSize: 10, whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.2 }}>
                            {disp1}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                            {parseTeamString(participant1, wrestlerMap).slugs.map((slug) => (
                              <FantasyPtsLine key={slug} slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={0} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <Link to={wrestlerTo(participant1)} onClick={e => e.stopPropagation()} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: winnerIs1 ? '#C6A04F' : '#fff',
                            fontWeight: winnerIs1 ? 'bold' : 'normal',
                            textDecoration: 'none',
                          }}>
                            <img
                              src={wrestlerMap[firstSlug(participant1)]?.image_url || wrestlerMap[participant1]?.image_url || '/images/placeholder.png'}
                              alt={disp1}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: winnerIs1 ? '2px solid #C6A04F' : '1px solid #666',
                              }}
                            />
                            <span style={{ fontSize: 10, maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {disp1}
                            </span>
                          </Link>
                          <FantasyPtsLine slug={participant1} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={0} />
                        </div>
                      )}
                      
                      <div style={{ color: '#C6A04F', fontSize: 9, fontWeight: 'bold' }}>vs</div>
                      
                      {isTagGauntlet ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, maxWidth: 120 }}>
                          <span style={{ color: winnerIs2 ? '#C6A04F' : '#fff', fontWeight: winnerIs2 ? 'bold' : 'normal', fontSize: 10, whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.2 }}>
                            {disp2}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                            {parseTeamString(participant2, wrestlerMap).slugs.map((slug) => (
                              <FantasyPtsLine key={slug} slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={0} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <Link to={wrestlerTo(participant2)} onClick={e => e.stopPropagation()} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: winnerIs2 ? '#C6A04F' : '#fff',
                            fontWeight: winnerIs2 ? 'bold' : 'normal',
                            textDecoration: 'none',
                          }}>
                            <img
                              src={wrestlerMap[firstSlug(participant2)]?.image_url || wrestlerMap[participant2]?.image_url || '/images/placeholder.png'}
                              alt={disp2}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: winnerIs2 ? '2px solid #C6A04F' : '1px solid #666',
                              }}
                            />
                            <span style={{ fontSize: 10, maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {disp2}
                            </span>
                          </Link>
                          <FantasyPtsLine slug={participant2} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={0} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return matches;
            })()}
          </div>
          
          {(() => {
            let finalWinner = null;
            let finalWinnerSlug = null;
            if (match.winner) {
              if (match.matchType === 'Tag Team Gauntlet Match' && match.winner.includes(' & ')) {
                finalWinner = match.winner.split('&').map(s => wrestlerMap[s.trim()]?.name || s.trim()).join(' & ');
                finalWinnerSlug = match.winner;
              } else {
                const winnerEntry = Object.entries(wrestlerMap).find(([slug, wrestler]) =>
                  wrestler.name === match.winner || slug === match.winner
                );
                if (winnerEntry) {
                  finalWinner = winnerEntry[1].name;
                  finalWinnerSlug = winnerEntry[0];
                } else {
                  finalWinner = match.winner;
                  finalWinnerSlug = match.winner;
                }
              }
            }
            
            return finalWinner ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginTop: 16,
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: 16,
                  background: '#2a2a2a',
                  borderRadius: 8,
                  border: '2px solid #C6A04F',
                  minWidth: 160,
                  minHeight: 120,
                }}>
                  <div style={{
                    color: '#C6A04F',
                    fontWeight: 800,
                    fontSize: 16,
                    textAlign: 'center',
                    marginBottom: 8,
                  }}>
                    WINNER
                  </div>
                  {match.matchType === 'Tag Team Gauntlet Match' && finalWinnerSlug && finalWinnerSlug.includes(' & ') ? (
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {finalWinnerSlug.split('&').map(s => s.trim()).filter(Boolean).map((slug) => (
                        <div key={slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                            <img
                              src={wrestlerMap[slug]?.image_url || '/images/placeholder.png'}
                              alt={wrestlerMap[slug]?.name || slug}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid #C6A04F',
                                marginBottom: 6,
                              }}
                            />
                            <span style={{
                              fontSize: 12,
                              color: '#C6A04F',
                              fontWeight: 'bold',
                              textAlign: 'center',
                              maxWidth: 100,
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                              lineHeight: 1.2,
                            }}>
                              {wrestlerMap[slug]?.name || slug}
                            </span>
                          </Link>
                          <FantasyPtsLine slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={4} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Link to={wrestlerTo(finalWinnerSlug)} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                        <img
                          src={wrestlerMap[finalWinnerSlug]?.image_url || '/images/placeholder.png'}
                          alt={finalWinner || 'Winner'}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #C6A04F',
                            marginBottom: 8,
                          }}
                        />
                        <span style={{
                          fontSize: 14,
                          color: '#C6A04F',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          maxWidth: 80,
                        }}>
                          {finalWinner || 'Winner'}
                        </span>
                      </Link>
                      <FantasyPtsLine slug={finalWinnerSlug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={4} />
                    </div>
                  )}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      ) : match.matchType === 'Battle Royal' && Array.isArray(match.participants) ? (
        match.winner ? (() => {
          const others = match.participants.filter(slug => slug !== match.winner);
          const half = Math.ceil(others.length / 2);
          const left = others.slice(0, half);
          const right = others.slice(half);
          
          const renderGrid = (arr) => {
            const numCols = 2;
            const numRows = Math.ceil(arr.length / numCols);
            let grid = [];
            for (let row = 0; row < numRows; row++) {
              let rowItems = [];
              for (let col = 0; col < numCols; col++) {
                const idx = row + col * numRows;
                if (arr[idx]) {
                  const slug = arr[idx];
                  rowItems.push(
                    <div key={slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ display: 'block', lineHeight: 0 }}>
                        <img
                          src={wrestlerMap[slug]?.image_url || '/images/placeholder.png'}
                          alt={wrestlerMap[slug]?.name || slug}
                          title={wrestlerMap[slug]?.name || slug}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #888',
                            background: '#222',
                            margin: 6,
                            boxShadow: '0 0 6px #0008',
                            transition: 'all 0.2s',
                            display: 'block',
                          }}
                        />
                      </Link>
                      <FantasyPtsLine slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={2} />
                    </div>
                  );
                } else {
                  rowItems.push(<div key={`empty-${col}-${row}`} style={{ width: 38, height: 38, margin: 6 }} />);
                }
              }
              grid.push(
                <div key={row} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>{rowItems}</div>
              );
            }
            return grid;
          };
          
          return (
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              gap: 24,
              flexWrap: 'wrap',
              width: '100%',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {renderGrid(left)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 120 }}>
                <Link to={wrestlerTo(match.winner)} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
                  <img
                    src={wrestlerMap[match.winner]?.image_url || '/images/placeholder.png'}
                    alt={wrestlerMap[match.winner]?.name || match.winner}
                    title={wrestlerMap[match.winner]?.name || match.winner}
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '5px solid #C6A04F',
                      boxShadow: '0 0 18px #C6A04F88',
                      background: '#222',
                      margin: 2,
                      transition: 'all 0.2s',
                    }}
                  />
                  <div style={{ fontWeight: 800, fontSize: 20, color: '#C6A04F', marginTop: 10, textAlign: 'center' }}>
                    {wrestlerMap[match.winner]?.name || match.winner}
                  </div>
                  <div style={{ color: '#fff', fontSize: 15, textAlign: 'center' }}>Winner</div>
                  <FantasyPtsLine slug={match.winner} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={6} />
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {renderGrid(right)}
              </div>
            </div>
          );
        })() : (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 16,
            maxWidth: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            {(Array.isArray(match.participants) ? match.participants : []).map(slug => (
              <div key={slug} style={{ display: 'inline-block', textAlign: 'center', verticalAlign: 'top' }}>
                <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ display: 'inline-block', textDecoration: 'none' }}>
                  <img
                    src={wrestlerMap[slug]?.image_url || '/images/placeholder.png'}
                    alt={wrestlerMap[slug]?.name || slug}
                    title={wrestlerMap[slug]?.name || slug}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #888',
                      background: '#222',
                      margin: 2,
                      transition: 'all 0.2s',
                    }}
                  />
                </Link>
                {!wrestlerMap[slug] && <div style={{color:'red',fontSize:10}}>{slug}</div>}
                <FantasyPtsLine slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={4} />
              </div>
            ))}
          </div>
        )
      ) : match.matchType === 'Royal Rumble' && Array.isArray(match.participants) ? (
        match.winner ? (() => {
          const others = match.participants.filter(slug => slug !== match.winner);
          const half = Math.ceil(others.length / 2);
          const left = others.slice(0, half);
          const right = others.slice(half);
          
          const renderGrid = (arr) => {
            const numCols = 2;
            const numRows = Math.ceil(arr.length / numCols);
            let grid = [];
            for (let row = 0; row < numRows; row++) {
              let rowItems = [];
              for (let col = 0; col < numCols; col++) {
                const idx = row + col * numRows;
                if (arr[idx]) {
                  const slug = arr[idx];
                  rowItems.push(
                    <div key={slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ display: 'block', lineHeight: 0 }}>
                        <img
                          src={wrestlerMap[slug]?.image_url || '/images/placeholder.png'}
                          alt={wrestlerMap[slug]?.name || slug}
                          title={wrestlerMap[slug]?.name || slug}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #888',
                            background: '#222',
                            margin: 6,
                            boxShadow: '0 0 6px #0008',
                            transition: 'all 0.2s',
                            display: 'block',
                          }}
                        />
                      </Link>
                      <FantasyPtsLine slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={2} />
                    </div>
                  );
                } else {
                  rowItems.push(<div key={`empty-${col}-${row}`} style={{ width: 38, height: 38, margin: 6 }} />);
                }
              }
              grid.push(
                <div key={row} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>{rowItems}</div>
              );
            }
            return grid;
          };
          
          // Calculate Royal Rumble stats (works with eliminations only, or entryOrder + eliminations)
          const calculateRoyalRumbleStats = () => {
            const { entryOrder = [], eliminations = [], manualIronman } = match.royalRumbleData || {};
            
            // Helper to parse time string (MM:SS) to seconds
            const parseTime = (timeStr) => {
              if (!timeStr) return 0;
              const parts = timeStr.split(':');
              if (parts.length === 2) {
                return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
              }
              return 0;
            };
            
            const formatTime = (seconds) => {
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              return `${mins}:${secs.toString().padStart(2, '0')}`;
            };
            
            const participantStats = {};
            
            // Initialize from entry order if present
            entryOrder.forEach(entry => {
              const entrySeconds = parseTime(entry.entryTime);
              const officialSeconds = entry.timeInRing ? parseTime(entry.timeInRing) : null;
              participantStats[entry.slug] = {
                entryNumber: entry.entryNumber,
                entryTime: entry.entryTime,
                entrySeconds: entrySeconds,
                eliminationTime: null,
                eliminationSeconds: null,
                timeInRumble: officialSeconds,
                eliminations: 0
              };
            });
            
            // Ensure every participant from eliminations is in stats (so we can count eliminations without entry order)
            eliminations.forEach(elim => {
              [elim.eliminatedBy, elim.eliminatedBy2, elim.eliminated].filter(Boolean).forEach(slug => {
                if (!participantStats[slug]) {
                  participantStats[slug] = {
                    entryNumber: null,
                    entryTime: null,
                    entrySeconds: 0,
                    eliminationTime: null,
                    eliminationSeconds: null,
                    timeInRumble: null,
                    eliminations: 0
                  };
                }
              });
            });
            
            const hasOfficialTimes = entryOrder.some(entry => !!entry.timeInRing);
            
            // Find elimination times and count eliminations
            eliminations.forEach(elim => {
              if (elim.eliminated && elim.time) {
                const elimSeconds = parseTime(elim.time);
                if (participantStats[elim.eliminated]) {
                  const stats = participantStats[elim.eliminated];
                  stats.eliminationTime = elim.time;
                  stats.eliminationSeconds = elimSeconds;
                  if (stats.timeInRumble == null && stats.entrySeconds != null) {
                    stats.timeInRumble = elimSeconds - stats.entrySeconds;
                  }
                }
              }
              if (elim.eliminatedBy && participantStats[elim.eliminatedBy]) {
                participantStats[elim.eliminatedBy].eliminations++;
              }
              if (elim.eliminatedBy2 && participantStats[elim.eliminatedBy2]) {
                participantStats[elim.eliminatedBy2].eliminations++;
              }
            });
            
            if (match.winner && participantStats[match.winner]) {
              const winnerStats = participantStats[match.winner];
              if (winnerStats.timeInRumble == null && !winnerStats.eliminationTime && match.time) {
                const matchSeconds = parseTime(match.time);
                winnerStats.timeInRumble = matchSeconds - winnerStats.entrySeconds;
              }
            }
            
            let ironman = null;
            let maxTime = -1;
            Object.entries(participantStats).forEach(([slug, stats]) => {
              if (stats.timeInRumble != null && stats.timeInRumble > maxTime) {
                maxTime = stats.timeInRumble;
                ironman = { slug, time: formatTime(stats.timeInRumble), timeSeconds: stats.timeInRumble };
              }
            });
            if (!hasOfficialTimes && manualIronman && participantStats[manualIronman]) {
              const stats = participantStats[manualIronman];
              const timeSeconds = stats.timeInRumble != null ? stats.timeInRumble : null;
              ironman = { slug: manualIronman, time: timeSeconds != null ? formatTime(timeSeconds) : null, timeSeconds };
            }
            
            let mostEliminations = [];
            let maxElims = -1;
            Object.entries(participantStats).forEach(([slug, stats]) => {
              if (stats.eliminations > maxElims) {
                maxElims = stats.eliminations;
                mostEliminations = [{ slug, count: stats.eliminations }];
              } else if (stats.eliminations === maxElims && maxElims > 0) {
                mostEliminations.push({ slug, count: stats.eliminations });
              }
            });
            
            return {
              ironman,
              mostEliminations: mostEliminations.length > 0 ? mostEliminations : null,
              entryOrder: entryOrder.length > 0 ? entryOrder : null
            };
          };
          
          const stats = match.royalRumbleData ? calculateRoyalRumbleStats() : null;
          
          return (
            <>
              {/* Royal Rumble summary on card: Winner, Most Eliminations, Ironman */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                justifyContent: 'center',
                marginBottom: 16,
                padding: '12px 16px',
                background: '#1a1a1a',
                borderRadius: 8,
                border: '1px solid #C6A04F',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#C6A04F', fontWeight: 700, fontSize: 12 }}>Winner:</span>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{wrestlerMap[match.winner]?.name || match.winner}</span>
                </div>
                {stats?.mostEliminations && stats.mostEliminations.length > 0 && stats.mostEliminations[0].count > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#C6A04F', fontWeight: 700, fontSize: 12 }}>Most Eliminations:</span>
                    <span style={{ color: '#fff', fontSize: 14 }}>
                      {stats.mostEliminations.map((w, i) => (
                        <span key={w.slug}>
                          {i > 0 && ' & '}
                          <strong>{wrestlerMap[w.slug]?.name || w.slug}</strong>
                        </span>
                      ))}{' '}
                      ({stats.mostEliminations[0].count})
                    </span>
                  </div>
                )}
                {stats?.ironman && (stats.ironman.time || stats.ironman.timeSeconds != null) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#C6A04F', fontWeight: 700, fontSize: 12 }}>Ironman/Ironwoman:</span>
                    <span style={{ color: '#fff', fontSize: 14 }}>
                      <strong>{wrestlerMap[stats.ironman.slug]?.name || stats.ironman.slug}</strong>
                      {stats.ironman.time && ` (${stats.ironman.time})`}
                    </span>
                  </div>
                )}
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                gap: 24,
                flexWrap: 'wrap',
                width: '100%',
                overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {renderGrid(left)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 120 }}>
                  <img
                    src={wrestlerMap[match.winner]?.image_url || '/images/placeholder.png'}
                    alt={wrestlerMap[match.winner]?.name || match.winner}
                    title={wrestlerMap[match.winner]?.name || match.winner}
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '5px solid #C6A04F',
                      boxShadow: '0 0 18px #C6A04F88',
                      background: '#222',
                      margin: 2,
                      transition: 'all 0.2s',
                    }}
                  />
                  <div style={{ fontWeight: 800, fontSize: 20, color: '#C6A04F', marginTop: 10, textAlign: 'center' }}>
                    {wrestlerMap[match.winner]?.name || match.winner}
                  </div>
                  <div style={{ color: '#fff', fontSize: 15, textAlign: 'center' }}>Winner</div>
                  <FantasyPtsLine slug={match.winner} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={6} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {renderGrid(right)}
                </div>
              </div>
              
              {/* Entry Order & Eliminations (Winner / Most Eliminations / Ironman shown in Match Details below) */}
              {((stats?.entryOrder?.length || 0) > 0 ||
                  (match.royalRumbleData?.eliminations?.length || 0) > 0) ? (
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setShowRumbleDetails((v) => !v);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid #C6A04F',
                          background: '#232323',
                          color: '#C6A04F',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        {showRumbleDetails ? 'Hide Entry Order & Eliminations' : 'Show Entry Order & Eliminations'}
                      </button>

                      {showRumbleDetails && (
                        <>
                          {stats.entryOrder && stats.entryOrder.length > 0 && (
                            <div style={{ marginTop: 12, padding: 12, background: '#333', borderRadius: 6 }}>
                              <div
                                style={{
                                  color: '#C6A04F',
                                  fontWeight: 600,
                                  fontSize: 13,
                                  marginBottom: 8,
                                }}
                              >
                                Entry Order
                              </div>
                              <div style={{ color: '#fff', fontSize: 12, lineHeight: 1.6 }}>
                                {stats.entryOrder.map((entry) => (
                                  <span key={entry.slug} style={{ marginRight: 8 }}>
                                    #{entry.entryNumber}: {wrestlerMap[entry.slug]?.name || entry.slug} (
                                    {entry.entryTime})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {match.royalRumbleData &&
                            match.royalRumbleData.eliminations &&
                            match.royalRumbleData.eliminations.length > 0 && (
                              <div style={{ marginTop: 12, padding: 12, background: '#333', borderRadius: 6 }}>
                                <div
                                  style={{
                                    color: '#C6A04F',
                                    fontWeight: 600,
                                    fontSize: 13,
                                    marginBottom: 8,
                                  }}
                                >
                                  Eliminations
                                </div>
                                <div style={{ color: '#fff', fontSize: 12, lineHeight: 1.6 }}>
                                  {match.royalRumbleData.eliminations.map((elim, idx) => {
                                    const eliminatedName = wrestlerMap[elim.eliminated]?.name || elim.eliminated;
                                    const eliminatedByName =
                                      wrestlerMap[elim.eliminatedBy]?.name || elim.eliminatedBy;
                                    const eliminatedByName2 = elim.eliminatedBy2
                                      ? wrestlerMap[elim.eliminatedBy2]?.name || elim.eliminatedBy2
                                      : null;
                                    let elimText = eliminatedByName2
                                      ? `${eliminatedByName} & ${eliminatedByName2} eliminated ${eliminatedName}`
                                      : `${eliminatedByName} eliminated ${eliminatedName}`;
                                    if (elim.time) {
                                      elimText += ` (${elim.time})`;
                                    }
                                    return (
                                      <div key={idx} style={{ marginBottom: 4 }}>
                                        {elimText}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                        </>
                      )}
                    </div>
                  ) : null}
            </>
          );
        })() : (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 16,
            maxWidth: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            {(Array.isArray(match.participants) ? match.participants : []).map(slug => (
              <div key={slug} style={{ display: 'inline-block', textAlign: 'center', verticalAlign: 'top' }}>
                <img
                  src={wrestlerMap[slug]?.image_url || '/images/placeholder.png'}
                  alt={wrestlerMap[slug]?.name || slug}
                  title={wrestlerMap[slug]?.name || slug}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #888',
                    background: '#222',
                    margin: 2,
                    transition: 'all 0.2s',
                  }}
                />
                {!wrestlerMap[slug] && <div style={{color:'red',fontSize:10}}>{slug}</div>}
                <FantasyPtsLine slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={4} />
              </div>
            ))}
          </div>
        )
      ) : match.matchType === 'Elimination Chamber' && Array.isArray(match.participants) ? (
        match.winner ? (() => {
          const others = match.participants.filter(slug => slug !== match.winner);
          
          // Calculate longest lasting participant
          const calculateLongestLasting = () => {
            if (!match.eliminationChamberData) return null;
            
            const { starters = [], entryOrder = [], eliminations = [] } = match.eliminationChamberData;
            
            // Helper to parse time string (MM:SS) to seconds
            const parseTime = (timeStr) => {
              if (!timeStr) return 0;
              const parts = timeStr.split(':');
              if (parts.length === 2) {
                return parseInt(parts[0]) * 60 + parseInt(parts[1]);
              }
              return 0;
            };
            
            // Helper to format seconds to MM:SS
            const formatTime = (seconds) => {
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              return `${mins}:${secs.toString().padStart(2, '0')}`;
            };
            
            // Calculate time in match for each participant
            const participantStats = {};
            
            // Starters enter at 0:00
            starters.forEach(slug => {
              participantStats[slug] = {
                entryTime: '0:00',
                entrySeconds: 0,
                eliminationTime: null,
                eliminationSeconds: null,
                timeInMatch: null
              };
            });
            
            // Pod entrants enter at their entry time
            entryOrder.forEach(entry => {
              const entrySeconds = parseTime(entry.entryTime);
              participantStats[entry.slug] = {
                entryTime: entry.entryTime,
                entrySeconds: entrySeconds,
                eliminationTime: null,
                eliminationSeconds: null,
                timeInMatch: null
              };
            });
            
            // Find elimination times
            eliminations.forEach(elim => {
              if (elim.eliminated && elim.time && participantStats[elim.eliminated]) {
                const elimSeconds = parseTime(elim.time);
                participantStats[elim.eliminated].eliminationTime = elim.time;
                participantStats[elim.eliminated].eliminationSeconds = elimSeconds;
                participantStats[elim.eliminated].timeInMatch = elimSeconds - participantStats[elim.eliminated].entrySeconds;
              }
            });
            
            // For the winner, use match time if available
            if (match.winner && participantStats[match.winner]) {
              const winnerStats = participantStats[match.winner];
              if (!winnerStats.eliminationTime && match.time) {
                const matchSeconds = parseTime(match.time);
                winnerStats.timeInMatch = matchSeconds - winnerStats.entrySeconds;
              }
            }
            
            // Find longest lasting participant
            let longestLasting = null;
            let maxTime = -1;
            Object.entries(participantStats).forEach(([slug, stats]) => {
              if (stats.timeInMatch !== null && stats.timeInMatch > maxTime) {
                maxTime = stats.timeInMatch;
                longestLasting = { slug, time: formatTime(stats.timeInMatch), timeSeconds: stats.timeInMatch };
              }
            });
            
            return longestLasting;
          };
          
          const computedLongest = calculateLongestLasting();
          const manualIronman = match.eliminationChamberData?.manualIronman;
          const longestLasting = manualIronman
            ? { slug: manualIronman, time: null, timeSeconds: null }
            : computedLongest;
          
          return (
            <>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                width: '100%',
                overflow: 'hidden',
              }}>
                {/* Winner on top */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
                  <img
                    src={wrestlerMap[match.winner]?.image_url || '/images/placeholder.png'}
                    alt={wrestlerMap[match.winner]?.name || match.winner}
                    title={wrestlerMap[match.winner]?.name || match.winner}
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '5px solid #C6A04F',
                      boxShadow: '0 0 18px #C6A04F88',
                      background: '#222',
                      margin: 2,
                      transition: 'all 0.2s',
                    }}
                  />
                  <div style={{ fontWeight: 800, fontSize: 20, color: '#C6A04F', marginTop: 10, textAlign: 'center' }}>
                    {wrestlerMap[match.winner]?.name || match.winner}
                  </div>
                  <div style={{ color: '#fff', fontSize: 15, textAlign: 'center' }}>Winner</div>
                  <FantasyPtsLine slug={match.winner} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={6} />
                </div>
                {/* Other 5 participants in a single row below */}
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {others.map(slug => (
                    <Link key={slug} to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 0 }}>
                      <img
                        src={wrestlerMap[slug]?.image_url || '/images/placeholder.png'}
                        alt={wrestlerMap[slug]?.name || slug}
                        title={wrestlerMap[slug]?.name || slug}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #888',
                          background: '#222',
                          margin: 4,
                          boxShadow: '0 0 6px #0008',
                          transition: 'all 0.2s',
                          display: 'block',
                        }}
                      />
                      <div style={{ color: '#ccc', fontSize: 11, marginTop: 4, textAlign: 'center', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {wrestlerMap[slug]?.name || slug}
                      </div>
                      <FantasyPtsLine slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={4} />
                    </Link>
                  ))}
                </div>
              </div>
              
              {/* Elimination Chamber Stats */}
              {match.eliminationChamberData && (
                <div style={{
                  background: '#2a2a2a',
                  borderRadius: 8,
                  padding: 16,
                  marginTop: 8,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  border: '1px solid #444',
                  maxWidth: 600
                }}>
                  <div style={{ color: '#C6A04F', fontWeight: 700, fontSize: 16, marginBottom: 12, textAlign: 'center' }}>
                    Elimination Chamber Statistics
                  </div>
                  
                  {/* Longest Lasting (Iron Man / Iron Woman) */}
                  {longestLasting && (
                    <div style={{ marginBottom: 12, padding: 12, background: '#333', borderRadius: 6 }}>
                      <div style={{ color: '#C6A04F', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        Iron Man / Iron Woman (Longest Lasting)
                      </div>
                      <div style={{ color: '#fff', fontSize: 14 }}>
                        <strong>{wrestlerMap[longestLasting.slug]?.name || longestLasting.slug}</strong>
                        {longestLasting.time != null ? ` - ${longestLasting.time}` : ''}
                      </div>
                    </div>
                  )}
                  
                  {/* Starters */}
                  {match.eliminationChamberData.starters && match.eliminationChamberData.starters.length === 2 && (
                    <div style={{ marginBottom: 12, padding: 12, background: '#333', borderRadius: 6 }}>
                      <div style={{ color: '#C6A04F', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                        Starters (In Ring)
                      </div>
                      <div style={{ color: '#fff', fontSize: 14 }}>
                        {match.eliminationChamberData.starters.map((slug, idx) => (
                          <span key={slug} style={{ marginRight: 12 }}>
                            {wrestlerMap[slug]?.name || slug}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Entry Order */}
                  {match.eliminationChamberData.entryOrder && match.eliminationChamberData.entryOrder.length > 0 && (
                    <div style={{ marginBottom: 12, padding: 12, background: '#333', borderRadius: 6 }}>
                      <div style={{ color: '#C6A04F', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                        Pod Entry Order
                      </div>
                      <div style={{ color: '#fff', fontSize: 12, lineHeight: 1.6 }}>
                        {match.eliminationChamberData.entryOrder.map((entry, idx) => (
                          <div key={entry.slug} style={{ marginBottom: 4 }}>
                            #{entry.entryNumber}: {wrestlerMap[entry.slug]?.name || entry.slug} ({entry.entryTime})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Eliminations */}
                  {match.eliminationChamberData.eliminations && match.eliminationChamberData.eliminations.length > 0 && (
                    <div style={{ padding: 12, background: '#333', borderRadius: 6 }}>
                      <div style={{ color: '#C6A04F', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                        Eliminations
                      </div>
                      <div style={{ color: '#fff', fontSize: 12, lineHeight: 1.6 }}>
                        {match.eliminationChamberData.eliminations.map((elim, idx) => {
                          const eliminatedName = wrestlerMap[elim.eliminated]?.name || elim.eliminated;
                          let elimText;
                          if (elim.method === 'Referee decision' && !elim.eliminatedBy) {
                            elimText = `${eliminatedName} eliminated (Referee decision)`;
                            if (elim.time) elimText += ` at ${elim.time}`;
                          } else {
                            const eliminatedByName = wrestlerMap[elim.eliminatedBy]?.name || elim.eliminatedBy;
                            const eliminatedByName2 = elim.eliminatedBy2 ? wrestlerMap[elim.eliminatedBy2]?.name || elim.eliminatedBy2 : null;
                            elimText = eliminatedByName2 
                              ? `${eliminatedByName} & ${eliminatedByName2} eliminated ${eliminatedName}`
                              : `${eliminatedByName} eliminated ${eliminatedName}`;
                            if (elim.method) elimText += ` (${elim.method})`;
                            if (elim.time) elimText += elim.method ? ` at ${elim.time}` : ` (${elim.time})`;
                          }
                          return (
                            <div key={idx} style={{ marginBottom: 4 }}>
                              {elimText}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })() : (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 16,
            maxWidth: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            {(Array.isArray(match.participants) ? match.participants : []).map(slug => (
              <div key={slug} style={{ display: 'inline-block', textAlign: 'center', verticalAlign: 'top' }}>
                <img
                  src={wrestlerMap[slug]?.image_url || '/images/placeholder.png'}
                  alt={wrestlerMap[slug]?.name || slug}
                  title={wrestlerMap[slug]?.name || slug}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #888',
                    background: '#222',
                    margin: 2,
                    transition: 'all 0.2s',
                  }}
                />
                {!wrestlerMap[slug] && <div style={{color:'red',fontSize:10}}>{slug}</div>}
                <FantasyPtsLine slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={4} />
              </div>
            ))}
          </div>
        )
      ) : isMultiSide ? (
        <>
          {/* Center meta area – special treatment for promos */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            {match.matchType === 'Promo' ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: '#C6A04F',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#232323',
                      fontSize: 24,
                      boxShadow: '0 0 12px #C6A04F66',
                    }}
                  >
                    <span role="img" aria-label="Promo segment">🎤</span>
                  </div>
                  <div style={{ fontWeight: 800, color: '#C6A04F', fontSize: 14, marginTop: 6, textAlign: 'center', letterSpacing: 0.5 }}>
                    PROMO SEGMENT
                  </div>
                  {match.title && (
                    <div style={{ color: '#fff', fontSize: 13, marginTop: 2, textAlign: 'center', maxWidth: 260 }}>
                      {match.title}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, color: '#C6A04F', fontSize: 15, marginBottom: 2, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
                  {match.cardType}{isTitleMatch ? ' - Title Match' : ''}
                </div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 20, marginBottom: 2, textAlign: 'center' }}>
                  {match.isLive ? (
                    <span style={{ color: '#27ae60' }}>LIVE</span>
                  ) : (
                    match.result && match.result !== 'No winner' ? 'Final' : match.result
                  )}
                </div>
                <div style={{ color: '#bbb', fontSize: 15, marginBottom: 2, textAlign: 'center' }}>{match.method}</div>
                <div style={{ color: '#bbb', fontSize: 15, textAlign: 'center' }}>{match.time}</div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: match.matchType === 'Promo' && teamStrings.length > 7 ? 'column' : 'row', alignItems: 'flex-start', justifyContent: 'center', gap: match.matchType === 'Promo' && teamStrings.length > 7 ? 8 : 32, width: '100%' }}>
            {match.matchType === 'Promo' && teamStrings.length > 7 ? (
              (() => {
                const half = Math.ceil(teamStrings.length / 2);
                const row1 = teamStrings.slice(0, half);
                const row2 = teamStrings.slice(half);
                const renderPromoParticipant = (teamStr, sideIdx) => {
                  const { teamName, slugs } = parseTeamString(teamStr, wrestlerMap);
                  return (
                    <div key={sideIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: slugs.length > 1 ? 100 : 90 }}>
                      {teamName ? (
                        <div style={{ fontWeight: 700, color: '#C6A04F', fontSize: 11, textAlign: 'center', marginBottom: 6, maxWidth: 120, lineHeight: 1.2 }}>
                          {teamName}
                        </div>
                      ) : null}
                      {slugs.length > 1 ? (
                        <TagTeamPartnerNamesAndFantasyGrid
                          teamName={teamName}
                          suppressTeamTitle={!!teamName}
                          slugs={slugs}
                          wrestlerMap={wrestlerMap}
                          wrestlerTo={wrestlerTo}
                          nameColor="#fff"
                          nameFontSize={11}
                          nameFontWeight={600}
                          fantasyPointsBySlug={fantasyPointsBySlug}
                          avatarSize={48}
                          avatarBorder="1px solid #555"
                          style={{ marginTop: 6 }}
                        />
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {slugs.map((slug, i) => (
                              <div key={slug || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 92 }}>
                                <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ display: 'block', lineHeight: 0 }}>
                                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 * 0.6, color: '#7da2c1' }}>
                                    {wrestlerMap[slug]?.image_url
                                      ? <img src={wrestlerMap[slug].image_url} alt={wrestlerMap[slug].name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                                      : <span role="img" aria-label="wrestler">&#128100;</span>
                                    }
                                  </div>
                                </Link>
                                <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ fontWeight: 600, color: '#fff', fontSize: 11, textAlign: 'center', marginTop: 6, textDecoration: 'none', lineHeight: 1.15 }}>
                                  {wrestlerMap[slug]?.name || slug}
                                </Link>
                              </div>
                            ))}
                          </div>
                          <FantasyPtsLine slug={slugs[0]} fantasyPointsBySlug={fantasyPointsBySlug} />
                        </>
                      )}
                    </div>
                  );
                };
                return (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 16, width: '100%', marginBottom: 8 }}>
                      {row1.map((teamStr, i) => renderPromoParticipant(teamStr, i))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 16, width: '100%' }}>
                      {row2.map((teamStr, i) => renderPromoParticipant(teamStr, half + i))}
                    </div>
                  </>
                );
              })()
            ) : (
              (() => {
                const syncMultiSideTagHeader =
                  teamStrings.length === 2 &&
                  (() => {
                    const a = parseTeamString(teamStrings[0] || '', wrestlerMap);
                    const b = parseTeamString(teamStrings[1] || '', wrestlerMap);
                    return (a.slugs.length > 1 && a.teamName) || (b.slugs.length > 1 && b.teamName);
                  })();
                return teamStrings.map((teamStr, sideIdx) => {
                const { teamName, slugs } = parseTeamString(teamStr, wrestlerMap);
                return (
                  <div key={sideIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
                    {slugs.length > 1 ? (
                      <>
                        {syncMultiSideTagHeader ? (
                          <div style={{ minHeight: 40, marginBottom: 8, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                            {teamName ? (
                              <div style={{ fontSize: 20, fontWeight: 800, color: winnerIndex === sideIdx ? '#C6A04F' : '#fff', textAlign: 'center', lineHeight: 1.2 }}>
                                {teamName}
                              </div>
                            ) : null}
                          </div>
                        ) : teamName ? (
                          <div style={{ fontSize: 20, fontWeight: 800, color: winnerIndex === sideIdx ? '#C6A04F' : '#fff', textAlign: 'center', marginBottom: 8 }}>
                            {teamName}
                          </div>
                        ) : null}
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 6 }}>
                          {winnerIndex === sideIdx ? triangleDown : <span style={{ display: 'inline-block', width: 16, height: 8 }} />}
                        </div>
                        <TagTeamPartnerNamesAndFantasyGrid
                          teamName={teamName}
                          suppressTeamTitle={!!teamName}
                          slugs={slugs}
                          wrestlerMap={wrestlerMap}
                          wrestlerTo={wrestlerTo}
                          nameColor={winnerIndex === sideIdx ? '#C6A04F' : '#fff'}
                          nameFontSize={15}
                          nameFontWeight={700}
                          fantasyPointsBySlug={fantasyPointsBySlug}
                          avatarSize={64}
                          avatarBorder={winnerIndex === sideIdx ? '2px solid #C6A04F' : '1px solid #555'}
                          belowAvatar={
                            shouldShowBeltIcon && championIndex === sideIdx && match.title?.includes('Tag Team Championship')
                              ? (slug, i) => (
                                  <div style={{ marginTop: 4 }}>
                                    <BeltIcon size={24} />
                                  </div>
                                )
                              : null
                          }
                          style={{ marginBottom: 8 }}
                        />
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 6 }}>
                          {winnerIndex === sideIdx ? triangleDown : <span style={{ display: 'inline-block', width: 16, height: 8 }} />}
                        </div>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 8 }}>
                          {slugs.map((slug, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ display: 'block', lineHeight: 0 }}>
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 * 0.6, color: '#7da2c1', overflow: 'hidden', cursor: 'pointer' }}>
                                  {wrestlerMap[slug]?.image_url
                                    ? <img src={wrestlerMap[slug].image_url} alt={wrestlerMap[slug].name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                                    : <span role="img" aria-label="wrestler">&#128100;</span>
                                  }
                                </div>
                              </Link>
                              {shouldShowBeltIcon && championIndex === sideIdx && match.title?.includes('Tag Team Championship') && (
                                <div style={{ marginTop: 4 }}>
                                  <BeltIcon size={24} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <span style={{ fontWeight: 700, color: winnerIndex === sideIdx ? '#C6A04F' : '#fff', fontSize: 18, textAlign: 'center', marginBottom: 2 }}>
                          {teamName ? (
                            <>
                              <div style={{ fontSize: 20, fontWeight: 800, color: winnerIndex === sideIdx ? '#C6A04F' : '#fff' }}>{teamName}</div>
                              <div style={{ fontSize: 15, color: '#bbb', fontStyle: 'italic' }}>
                                {slugs.map((slug, i) => (
                                  <React.Fragment key={slug}>
                                    <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ color: '#bbb', textDecoration: 'none' }}>{wrestlerMap[slug]?.name || slug}</Link>
                                    {i < slugs.length - 1 ? ' & ' : ''}
                                  </React.Fragment>
                                ))}
                              </div>
                            </>
                          ) : (
                            slugs.map((slug, i) => (
                              <React.Fragment key={slug}>
                                <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ color: winnerIndex === sideIdx ? '#C6A04F' : '#fff', textDecoration: 'none' }}>{wrestlerMap[slug]?.name || slug}</Link>
                                {i < slugs.length - 1 ? ' & ' : ''}
                              </React.Fragment>
                            ))
                          )}
                        </span>
                      </>
                    )}
                    {cardView === 'statistics' && showStatsLastFive && (
                      <div style={{ alignSelf: slugs.length > 1 ? 'stretch' : 'center', display: 'flex', flexDirection: 'column', alignItems: slugs.length > 1 ? (sideIdx === 1 ? 'flex-end' : 'flex-start') : 'center', marginTop: 2 }}>
                        {slugs.map((slug) => {
                          const d = statsParticipantData.find((x) => x.slug === slug);
                          if (!d) return null;
                          const showName = slugs.length > 1;
                          const nameRight = sideIdx === 1;
                          return (
                            <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, justifyContent: showName ? (nameRight ? 'flex-end' : 'flex-start') : 'center' }}>
                              {showName && !nameRight && <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ color: '#bbb', fontSize: 11, minWidth: 72, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{d.name}</Link>}
                              <LastFiveBoxes outcomes={d.outcomes} size={22} />
                              {showName && nameRight && <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ color: '#bbb', fontSize: 11, minWidth: 72, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{d.name}</Link>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 24, marginTop: 2 }}>
                      {shouldShowBeltIcon && championIndex === sideIdx && !match.title?.includes('Tag Team Championship') ? (
                        <>
                          <BeltIcon size={36} />
                          {match.titleOutcome && match.titleOutcome !== 'None' && (
                            <div style={{ fontSize: 10, color: match.titleOutcome === 'New Champion' ? '#4CAF50' : '#FFC107', fontWeight: 600, marginTop: 2, textAlign: 'center' }}>{match.titleOutcome}</div>
                          )}
                        </>
                      ) : 
                       match.specialWinnerType && match.specialWinnerType !== 'None' && winnerIndex === sideIdx ? 
                       getSpecialWinnerIcon(match.specialWinnerType) : 
                       match.titleOutcome && match.titleOutcome === 'No. 1 Contender' && winnerIndex === sideIdx ? (
                         <div style={{ fontSize: 10, color: '#C6A04F', fontWeight: 600, marginTop: 2, textAlign: 'center' }}>{match.titleOutcome}</div>
                       ) : 
                       <span style={{ display: 'inline-block', width: 32, height: 16 }} />}
                    </div>
                    {slugs.length === 1 ? <FantasyPtsLine slug={slugs[0]} fantasyPointsBySlug={fantasyPointsBySlug} /> : null}
                  </div>
                );
                });
              })() )}
          </div>
        </>
      ) : !isMultiSide ? (
        (() => {
          const leftParsed = parseTeamString(teamStrings[0] || '', wrestlerMap);
          const rightParsed = parseTeamString(teamStrings[1] || '', wrestlerMap);
          const syncTagTopHeader =
            (leftParsed.slugs.length > 1 && leftParsed.teamName) ||
            (rightParsed.slugs.length > 1 && rightParsed.teamName);

          function renderTwoSideVisual(sideIdx, parsed) {
            const { teamName, slugs } = parsed;
            const won = sideIdx === 0 ? winnerIndex === 0 : winnerIndex === 1;
            return (
              <div style={{ flex: 0.7, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
                {syncTagTopHeader ? (
                  <div style={{ minHeight: 40, marginBottom: 8, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                    {slugs.length > 1 && teamName ? (
                      <div style={{ fontSize: 18, fontWeight: 800, color: won ? '#C6A04F' : '#fff', textAlign: 'center', lineHeight: 1.2 }}>{teamName}</div>
                    ) : null}
                  </div>
                ) : null}
                {slugs.length > 1 ? (
                  <TagTeamPartnerNamesAndFantasyGrid
                    teamName={teamName}
                    suppressTeamTitle={!!(syncTagTopHeader && slugs.length > 1 && teamName)}
                    slugs={slugs}
                    wrestlerMap={wrestlerMap}
                    wrestlerTo={wrestlerTo}
                    nameColor={won ? '#C6A04F' : '#fff'}
                    nameFontSize={13}
                    nameFontWeight={700}
                    fantasyPointsBySlug={fantasyPointsBySlug}
                    avatarSize={54}
                    avatarBorder={won ? '2px solid #C6A04F' : '1px solid #555'}
                    style={{ marginBottom: 6 }}
                  />
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginBottom: 6 }}>
                      {slugs.map((slug, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54 * 0.6, color: '#7da2c1' }}>
                            {wrestlerMap[slug]?.image_url
                              ? (
                                <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ display: 'block', lineHeight: 0 }}>
                                  <img
                                    src={wrestlerMap[slug].image_url}
                                    alt={wrestlerMap[slug].name}
                                    style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                                  />
                                </Link>
                              )
                              : <span role="img" aria-label="wrestler">&#128100;</span>
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                    <span style={{ fontWeight: 700, color: won ? '#C6A04F' : '#fff', fontSize: 16, textAlign: 'center', marginBottom: 2 }}>
                      {teamName ? (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 800, color: won ? '#C6A04F' : '#fff' }}>{teamName}</div>
                          <div style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic' }}>
                            {slugs.map((slug, i) => (
                              <React.Fragment key={slug}>
                                <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ color: '#bbb', textDecoration: 'none' }}>{wrestlerMap[slug]?.name || slug}</Link>
                                {i < slugs.length - 1 ? ' & ' : ''}
                              </React.Fragment>
                            ))}
                          </div>
                        </>
                      ) : (
                        slugs.map((slug, i) => (
                          <React.Fragment key={slug}>
                            <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ color: won ? '#C6A04F' : '#fff', textDecoration: 'none' }}>{wrestlerMap[slug]?.name || slug}</Link>
                            {i < slugs.length - 1 ? ' & ' : ''}
                          </React.Fragment>
                        ))
                      )}
                    </span>
                  </>
                )}
              </div>
            );
          }

          function renderTwoSideFooter(sideIdx, parsed) {
            const { slugs } = parsed;
            const champ = sideIdx === 0 ? championIndex === 0 : championIndex === 1;
            const sideExpandedSlug = slugs.includes(expandedSlug) ? expandedSlug : null;
            const expandedWrestler = sideExpandedSlug ? wrestlerMap[sideExpandedSlug] : null;
            return (
              <div style={{ flex: 0.7, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
                {cardView === 'statistics' && showStatsLastFive && slugs.map((slug) => {
                  const d = statsParticipantData.find((x) => x.slug === slug);
                  if (!d) return null;
                  const showName = slugs.length > 1;
                  const nameRight = sideIdx === 1;
                  return (
                    <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, justifyContent: showName ? (nameRight ? 'flex-end' : 'flex-start') : 'center' }}>
                      {showName && !nameRight && <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ color: '#bbb', fontSize: 11, minWidth: 60, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{d.name}</Link>}
                      <LastFiveBoxes outcomes={d.outcomes} size={24} />
                      {showName && nameRight && <Link to={wrestlerTo(slug)} onClick={e => e.stopPropagation()} style={{ color: '#bbb', fontSize: 11, minWidth: 60, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{d.name}</Link>}
                    </div>
                  );
                })}
                {expandedWrestler && renderWrestlerMeta(expandedWrestler)}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 18, marginTop: 2 }}>
                  {shouldShowBeltIcon && champ ? (
                    <>
                      {match.title?.includes('Tag Team Championship') ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <BeltIcon size={24} />
                          <BeltIcon size={24} />
                        </div>
                      ) : (
                        <BeltIcon size={32} />
                      )}
                      {match.titleOutcome && match.titleOutcome !== 'None' && (
                        <div style={{ fontSize: 9, color: match.titleOutcome === 'New Champion' ? '#4CAF50' : '#FFC107', fontWeight: 600, marginTop: 2, textAlign: 'center' }}>{match.titleOutcome}</div>
                      )}
                    </>
                  ) : 
                   match.specialWinnerType && match.specialWinnerType !== 'None' && (sideIdx === 0 ? winnerIndex === 0 : winnerIndex === 1) ? 
                   getSpecialWinnerIcon(match.specialWinnerType) : 
                   match.titleOutcome && match.titleOutcome === 'No. 1 Contender' && (sideIdx === 0 ? winnerIndex === 0 : winnerIndex === 1) ? (
                     <div style={{ fontSize: 9, color: '#C6A04F', fontWeight: 600, marginTop: 2, textAlign: 'center' }}>{match.titleOutcome}</div>
                   ) : 
                   <span style={{ display: 'inline-block', width: 24, height: 12 }} />}
                </div>
                {slugs.length === 1 ? <FantasyPtsLine slug={slugs[0]} fantasyPointsBySlug={fantasyPointsBySlug} /> : null}
              </div>
            );
          }

          const arrowColStyle = {
            width: 24,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
          };

          return (
        <>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          {renderTwoSideVisual(0, leftParsed)}
          <div style={arrowColStyle}>
            {winnerIndex === 0 ? triangleRight : <span style={{ display: 'inline-block', width: 14, height: 18, opacity: 0 }} />}
          </div>
          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 120, margin: 0, padding: 0, alignSelf: 'stretch' }}>
            {match.matchType === 'Promo' ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: '#C6A04F',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#232323',
                      fontSize: 24,
                      boxShadow: '0 0 12px #C6A04F66',
                    }}
                  >
                    <span role="img" aria-label="Promo segment">🎤</span>
                  </div>
                  <div style={{ fontWeight: 800, color: '#C6A04F', fontSize: 13, marginTop: 6, textAlign: 'center', letterSpacing: 0.5 }}>
                    PROMO SEGMENT
                  </div>
                  {match.title && (
                    <div style={{ color: '#fff', fontSize: 13, marginTop: 2, textAlign: 'center', maxWidth: 260 }}>
                      {match.title}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, color: '#C6A04F', fontSize: 13, marginBottom: 2, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                  {match.cardType}{isTitleMatch ? ' - Title Match' : ''}
                </div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 16, marginBottom: 2, textAlign: 'center' }}>
                  {isMatchInProgress ? (
                    <span style={{ color: '#27ae60' }}>MATCH IN PROGRESS</span>
                  ) : (
                    match.result && match.result !== 'No winner' ? 'Final' : match.result
                  )}
                </div>
                <div style={{ color: '#bbb', fontSize: 12, marginBottom: 2, textAlign: 'center' }}>{match.method}</div>
                <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center' }}>{match.time}</div>
              </>
            )}
          </div>
          <div style={arrowColStyle}>
            {winnerIndex === 1 ? triangleLeft : <span style={{ display: 'inline-block', width: 14, height: 18, opacity: 0 }} />}
          </div>
          {renderTwoSideVisual(1, rightParsed)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginTop: 2 }}>
          {renderTwoSideFooter(0, leftParsed)}
          <div style={{ width: 24, flexShrink: 0 }} />
          <div style={{ flex: 1.2, minWidth: 120 }} />
          <div style={{ width: 24, flexShrink: 0 }} />
          {renderTwoSideFooter(1, rightParsed)}
        </div>
        </>
          );
        })() ) : null}
      
      {match.result && match.matchType === 'Battle Royal' && (
        <div style={{
          background: '#2a2a2a',
          borderRadius: 8,
          padding: 12,
          marginTop: 8,
          marginLeft: 'auto',
          marginRight: 'auto',
          border: '1px solid #444',
          maxWidth: 500,
          textAlign: 'center'
        }}>
          <div style={{ color: '#C6A04F', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            Battle Royal Result
          </div>
          <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.4 }}>
            {match.result}
          </div>
        </div>
      )}
      
      {match.result && match.matchType === 'Royal Rumble' && !(match.royalRumbleData && match.royalRumbleData.entryOrder && Array.isArray(match.royalRumbleData.entryOrder) && match.royalRumbleData.entryOrder.length > 0) && (() => {
        const elims = match.royalRumbleData?.eliminations || [];
        const elimCounts = {};
        elims.forEach(elim => {
          [elim.eliminatedBy, elim.eliminatedBy2].filter(Boolean).forEach(slug => {
            elimCounts[slug] = (elimCounts[slug] || 0) + 1;
          });
        });
        let mostElimList = [];
        let maxE = -1;
        Object.entries(elimCounts).forEach(([slug, count]) => {
          if (count > maxE) { maxE = count; mostElimList = [{ slug, count }]; }
          else if (count === maxE) mostElimList.push({ slug, count });
        });
        return (
          <div style={{ marginTop: 8, marginLeft: 'auto', marginRight: 'auto', maxWidth: 500 }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              justifyContent: 'center',
              marginBottom: 12,
              padding: '12px 16px',
              background: '#1a1a1a',
              borderRadius: 8,
              border: '1px solid #C6A04F',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#C6A04F', fontWeight: 700, fontSize: 12 }}>Winner:</span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{match.winner ? (wrestlerMap[match.winner]?.name || match.winner) : '—'}</span>
              </div>
              {mostElimList.length > 0 && mostElimList[0].count > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#C6A04F', fontWeight: 700, fontSize: 12 }}>Most Eliminations:</span>
                  <span style={{ color: '#fff', fontSize: 14 }}>
                    {mostElimList.map((w, i) => (
                      <span key={w.slug}>
                        {i > 0 && ' & '}
                        <strong>{wrestlerMap[w.slug]?.name || w.slug}</strong>
                      </span>
                    ))}{' '}
                    ({mostElimList[0].count})
                  </span>
                </div>
              )}
            </div>
            <div style={{
              background: '#2a2a2a',
              borderRadius: 8,
              padding: 12,
              border: '1px solid #444',
              textAlign: 'center'
            }}>
              <div style={{ color: '#C6A04F', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                Royal Rumble Result
              </div>
              <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.4 }}>
                {match.result}
              </div>
            </div>
          </div>
        );
      })()}
      
      {(match.matchType === 'Survivor Series-style 10-man Tag Team Elimination match' || match.matchType?.includes('Survivor Series')) && match.survivorSeriesData && match.survivorSeriesData.eliminations && Array.isArray(match.survivorSeriesData.eliminations) && match.survivorSeriesData.eliminations.length > 0 && (
        <div style={{
          background: '#2a2a2a',
          borderRadius: 8,
          padding: 12,
          marginTop: 8,
          marginLeft: 'auto',
          marginRight: 'auto',
          border: '1px solid #444',
          maxWidth: 500
        }}>
          <div style={{ color: '#C6A04F', fontWeight: 700, fontSize: 14, marginBottom: 8, textAlign: 'center' }}>
            Eliminations
          </div>
          <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.6 }}>
            {[...match.survivorSeriesData.eliminations].sort((a, b) => a.order - b.order).map((elim, index) => {
              const eliminatedName = wrestlerMap[elim.eliminated]?.name || elim.eliminated;
              const eliminatedByName = wrestlerMap[elim.eliminatedBy]?.name || elim.eliminatedBy;
              // Format: "Wrestler eliminates Wrestler (time)" for pinfall/submission
              // "Wrestler eliminates Wrestler (method, time)" for other methods
              let eliminationText = `${eliminatedByName} eliminates ${eliminatedName}`;
              if (elim.time) {
                if (elim.method === 'Pinfall' || elim.method === 'Submission') {
                  eliminationText += ` (${elim.time})`;
                } else {
                  const methodText = elim.method === 'Count out' ? 'counted out' : elim.method.toLowerCase();
                  eliminationText += ` (${methodText}, ${elim.time})`;
                }
              } else if (elim.method && elim.method !== 'Pinfall' && elim.method !== 'Submission') {
                const methodText = elim.method === 'Count out' ? 'counted out' : elim.method.toLowerCase();
                eliminationText += ` (${methodText})`;
              }
              return (
                <div key={index} style={{ marginBottom: 4, textAlign: 'left', paddingLeft: 8 }}>
                  {eliminationText}
                </div>
              );
            })}
          </div>
          {match.survivorSeriesData.survivorName || match.survivorSeriesData.survivor ? (
            <div style={{ 
              color: '#C6A04F', 
              fontWeight: 700, 
              fontSize: 14, 
              marginTop: 12, 
              paddingTop: 12, 
              borderTop: '1px solid #444',
              textAlign: 'center'
            }}>
              Survivor: {wrestlerMap[match.survivorSeriesData.survivor]?.name || match.survivorSeriesData.survivorName || match.survivorSeriesData.survivor}
            </div>
          ) : null}
          {Array.isArray(match.participants) && match.participants.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #444' }}>
              <div style={{ color: '#C6A04F', fontWeight: 600, fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
                Fantasy points
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
                {[...new Set(match.participants.map((s) => String(s).trim()).filter(Boolean))].map((slug) => (
                  <div key={slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 130 }}>
                    <span style={{ fontSize: 10, color: '#aaa', marginBottom: 2, textAlign: 'center', lineHeight: 1.2 }}>
                      {wrestlerMap[slug]?.name || slug}
                    </span>
                    <FantasyPtsLine slug={slug} fantasyPointsBySlug={fantasyPointsBySlug} marginTop={0} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <MatchCardTabsSection
        match={match}
        event={event}
        wrestlerMap={wrestlerMap}
        events={events}
        matchIndex={matchIndex}
        royalRumbleHighlights={royalRumbleHighlights}
        wrestlerTo={wrestlerTo}
        summaryContent={summaryContent}
        hasSummary={hasSummary}
        hasCommentary={hasCommentary}
        cardView={cardView}
        setCardView={setCardView}
      />
    </div>
  );
} 