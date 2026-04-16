'use client';

import React, { useMemo } from 'react';
import { Link } from '@/components/boxscore-port/router-bridge';
import countries from './data/countries';
import {
  getLastMatchesForWrestler,
  getMatchOutcome,
  getMatchRecordStatsForYear,
  getYearFromEventDate,
} from './utils/matchOutcomes';
import {
  getWinnerSideIndex,
  parseTeamStringForPage,
  getSidesFromMatchParticipants,
  normalizeParticipantsToVersusString,
  shouldUseTagTeamMultiGrid,
} from './utils/matchPageLayout';

const gold = '#C6A04F';

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
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age--;
  return age;
}

const OUTCOME_COLORS = { W: '#2e7d32', D: '#f9a825', L: '#c62828' };

function LastFiveBoxes({ outcomes, size = 22 }) {
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

function teammateSizing(teammateCount) {
  if (teammateCount <= 1) {
    return { cardMax: 200, imgMax: 180, imgMaxH: 320, nameSize: 15, infoH: 200 };
  }
  if (teammateCount === 2) {
    return { cardMax: 168, imgMax: 155, imgMaxH: 260, nameSize: 14, infoH: 176 };
  }
  return { cardMax: 118, imgMax: 108, imgMaxH: 200, nameSize: 12, infoH: 158 };
}

function WrestlerDetailBlock({ slug, wrestlerMap, events, match, event, isWinner, teammateCount = 1, matchIndex }) {
  const w = wrestlerMap[slug];
  const country = w ? getCountryForNationality(w.nationality) : null;
  const age = w ? calculateAgeFromDob(w.dob) : null;
  const sz = teammateSizing(teammateCount);

  const lastFive = useMemo(() => {
    if (!events || !match || !wrestlerMap) return [];
    const priorToMatch =
      event?.id != null && (matchIndex != null || match?.order != null)
        ? { eventId: event.id, matchIndex, matchOrder: match?.order }
        : undefined;
    const list = getLastMatchesForWrestler(events, slug, 5, { wrestlerMap, priorToMatch });
    return list.map(({ match: m }) => getMatchOutcome(m, slug, wrestlerMap));
  }, [events, match, slug, wrestlerMap, event?.id, matchIndex, match?.order]);

  const ytd = useMemo(() => {
    if (!events || !slug || !event?.date) return null;
    const y = getYearFromEventDate(event.date);
    if (y == null) return null;
    return getMatchRecordStatsForYear(events, slug, y, wrestlerMap);
  }, [events, slug, event?.date, wrestlerMap]);

  const img = w?.full_body_image_url || w?.image_url || '/images/placeholder.png';
  const imgBoxW = sz.imgMax;
  const imgBoxH = sz.imgMaxH;
  const infoH = sz.infoH;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: teammateCount > 1 ? '1 1 0' : 1,
        minWidth: teammateCount > 1 ? 0 : undefined,
        alignSelf: 'stretch',
        width: '100%',
        maxWidth: sz.cardMax,
        margin: '0 auto',
        height: '100%',
        minHeight: 0,
        justifyContent: 'flex-start',
        padding: '8px 10px',
        borderRadius: 10,
        border: `2px solid ${isWinner ? gold : '#444'}`,
        boxSizing: 'border-box',
        background: isWinner ? '#2a2618' : '#1e1e1e',
      }}
    >
      <Link
        to={`/wrestlers/${encodeURIComponent(slug)}`}
        style={{
          lineHeight: 0,
          textDecoration: 'none',
          display: 'block',
          width: '100%',
          maxWidth: imgBoxW,
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: imgBoxW,
            height: imgBoxH,
            boxSizing: 'border-box',
            margin: '0 auto',
            borderRadius: 8,
            background: '#111',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <img
            src={img}
            alt={w?.name || slug}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center bottom',
              display: 'block',
            }}
          />
        </div>
      </Link>
      <div
        style={{
          marginTop: 10,
          textAlign: 'center',
          width: '100%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: infoH,
          minHeight: infoH,
          maxHeight: infoH,
          overflowX: 'hidden',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box',
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <Link
          to={`/wrestlers/${encodeURIComponent(slug)}`}
          style={{ color: isWinner ? gold : '#fff', fontWeight: 800, fontSize: sz.nameSize, textDecoration: 'none', wordBreak: 'break-word' }}
        >
          {w?.name || slug}
        </Link>
        {(w?.height || w?.weight) && (
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
            {[w.height, w.weight].filter(Boolean).join(' · ')}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
          {(country || w?.nationality) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
              {country?.flagImage && (
                <img
                  src={country.flagImage}
                  alt=""
                  style={{ width: 18, height: 13, objectFit: 'cover', borderRadius: 2 }}
                />
              )}
              {!country?.flagImage && country?.flag && <span>{country.flag}</span>}
              {w?.nationality}
            </span>
          )}
          {age != null && <span style={{ marginLeft: w?.nationality ? 8 : 0 }}>{w?.nationality ? ' · ' : ''}Age {age}</span>}
        </div>
        {ytd && ytd.mw > 0 && (
          <div style={{ fontSize: 11, color: '#9a9a9a', marginTop: 8, lineHeight: 1.4 }}>
            <span style={{ color: gold }}>{getYearFromEventDate(event.date)} record</span>
            <br />
            {ytd.mw} MW · {ytd.winTotal}-{ytd.lossTotal}-{ytd.nc} (W-L-NC) · {ytd.winPct}% wins
          </div>
        )}
        {lastFive.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>Last {lastFive.length} (before this event)</div>
            <LastFiveBoxes outcomes={lastFive} size={22} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, width: '100%' }} aria-hidden />
    </div>
  );
}

function TeammateRow({ slugs, winnerIndex, sideIdx, wrestlerMap, events, match, event, matchIndex }) {
  const n = slugs.length;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: n > 1 ? 'nowrap' : 'wrap',
        justifyContent: 'center',
        alignItems: 'stretch',
        gap: 10,
        width: '100%',
        minWidth: 0,
        flex: 1,
        minHeight: 0,
        ...(n > 2 ? { overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 } : {}),
      }}
    >
      {slugs.map((slug) => (
        <WrestlerDetailBlock
          key={slug}
          slug={slug}
          wrestlerMap={wrestlerMap}
          events={events}
          match={match}
          event={event}
          isWinner={winnerIndex === sideIdx}
          teammateCount={n}
          matchIndex={matchIndex}
        />
      ))}
    </div>
  );
}

/**
 * Full-image match header for singles, tag, triple threat, fatal four-way, and 6-person tag.
 * Ported from PWBS MatchPageHero.
 */
export default function MatchPageHero({ match, event, wrestlerMap, events, matchIndex }) {
  const teamStrings = getSidesFromMatchParticipants(match);
  const winnerIndex = teamStrings.length > 0 ? getWinnerSideIndex(teamStrings, match, wrestlerMap) : -1;
  const displayStipulation =
    match.stipulation === 'Custom/Other' && (match.customStipulation || '').trim()
      ? match.customStipulation.trim()
      : match.stipulation || '';
  const isTitleMatch = match.title && match.title !== 'None' && match.stipulation !== 'No. 1 Contender Match';
  const isMatchInProgress = event?.status === 'live' && match?.isLive;

  const sides = teamStrings.map((ts) => parseTeamStringForPage(ts, wrestlerMap));
  const normalizedParticipantsHint = normalizeParticipantsToVersusString(match);

  const tagGridMode = shouldUseTagTeamMultiGrid(match, teamStrings, sides);
  const useTagGrid2x2 = tagGridMode === '2x2';
  const useTagGrid1x3 = tagGridMode === '1x3';

  const isMultiWay =
    match.matchType === 'Triple Threat match' ||
    match.matchType === 'Fatal Four-way match' ||
    match.matchType === '5-way Match' ||
    (typeof match.matchType === 'string' && /^\d+-way Match$/i.test(match.matchType)) ||
    match.matchType === '3-way Tag Team' ||
    match.matchType === '4-way Tag Team' ||
    displayStipulation === '3-way Tag Team' ||
    displayStipulation === '4-way Tag Team' ||
    useTagGrid2x2 ||
    useTagGrid1x3;

  const sideHasMultipleSlugs = (s) => (s?.slugs?.length ?? 0) > 1;
  const sideHasTeamName = (s) => !!(s?.teamName && String(s.teamName).trim());
  const reserveTeamNameSlotVs =
    sideHasMultipleSlugs(sides[0]) ||
    sideHasMultipleSlugs(sides[1]) ||
    sideHasTeamName(sides[0]) ||
    sideHasTeamName(sides[1]);
  const reserveTeamNameSlotMulti = sides.some((s) => sideHasMultipleSlugs(s) || sideHasTeamName(s));

  const teamNameSlotVsStyle = {
    minHeight: 48,
    fontWeight: 800,
    fontSize: 17,
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1.25,
  };
  const teamNameSlotMultiStyle = {
    minHeight: 44,
    fontWeight: 800,
    fontSize: 15,
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1.25,
  };

  return (
    <div
      style={{
        background: '#232323',
        borderRadius: 12,
        border: match.cardType === 'Main Event' ? `2px solid ${gold}` : '1px solid #444',
        boxShadow: '0 0 12px #C6A04F22',
        padding: '20px 16px 24px',
        marginBottom: 20,
      }}
    >
      {match.cardType === 'Main Event' && (
        <div
          style={{
            textAlign: 'center',
            marginBottom: 12,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1,
            color: '#232323',
            background: gold,
            padding: '4px 12px',
            borderRadius: 8,
            display: 'inline-block',
            marginLeft: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          MAIN EVENT
        </div>
      )}

      {teamStrings.length === 0 && (
        <div
          style={{
            color: '#aaa',
            textAlign: 'center',
            padding: '12px 8px 0',
            fontSize: 13,
            lineHeight: 1.45,
            marginBottom: 8,
          }}
        >
          Could not parse teams from participant data. Use &quot;vs&quot; between sides.
          {normalizedParticipantsHint ? (
            <>
              {' '}Normalized:{' '}
              <span style={{ color: '#666', wordBreak: 'break-word' }}>
                {normalizedParticipantsHint.slice(0, 280)}
                {normalizedParticipantsHint.length > 280 ? '…' : ''}
              </span>
            </>
          ) : null}
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: gold, fontWeight: 700, marginBottom: 6 }}>
          {[match.matchType, displayStipulation && displayStipulation !== 'None' ? displayStipulation : null, match.title && match.title !== 'None' ? match.title : null]
            .filter(Boolean)
            .join(' — ')}
        </div>
        <div style={{ fontSize: 14, color: gold, marginBottom: 4 }}>
          {match.cardType}
          {isTitleMatch ? ' — Title match' : ' — Non-title match'}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>
          {isMatchInProgress ? <span style={{ color: '#27ae60' }}>MATCH IN PROGRESS</span> : match.result && match.result !== 'No winner' ? 'Final' : match.result || '—'}
        </div>
        <div style={{ color: '#bbb', fontSize: 15, marginTop: 4 }}>{match.method}</div>
        <div style={{ color: '#bbb', fontSize: 15 }}>{match.time}</div>
      </div>

      {isMultiWay ? (
        useTagGrid2x2 || useTagGrid1x3 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: useTagGrid2x2 ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
              gap: 12,
              width: '100%',
              maxWidth: 1280,
              margin: '0 auto',
              alignItems: 'stretch',
            }}
          >
            {sides.map((side, sideIdx) => (
              <div
                key={sideIdx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 8,
                  minWidth: 0,
                  padding: '12px 10px',
                  borderRadius: 10,
                  border: `2px solid ${winnerIndex === sideIdx ? gold : '#444'}`,
                  background: winnerIndex === sideIdx ? '#2a2618' : '#1e1e1e',
                  boxSizing: 'border-box',
                }}
              >
                {reserveTeamNameSlotMulti ? (
                  <div
                    style={{
                      ...teamNameSlotMultiStyle,
                      color: winnerIndex === sideIdx ? gold : '#fff',
                    }}
                  >
                    {side.teamName || '\u00a0'}
                  </div>
                ) : side.teamName ? (
                  <div style={{ fontWeight: 800, color: winnerIndex === sideIdx ? gold : '#fff', fontSize: 15, textAlign: 'center' }}>{side.teamName}</div>
                ) : null}
                <TeammateRow
                  slugs={side.slugs}
                  winnerIndex={winnerIndex}
                  sideIdx={sideIdx}
                  wrestlerMap={wrestlerMap}
                  events={events}
                  match={match}
                  event={event}
                  matchIndex={matchIndex}
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              alignItems: 'stretch',
              width: '100%',
            }}
          >
            {sides.map((side, sideIdx) => (
              <React.Fragment key={sideIdx}>
                {sideIdx > 0 && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: gold, alignSelf: 'center', padding: '0 6px' }}>
                    VS
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 8,
                    flex: '1 1 200px',
                    minWidth: 0,
                    maxWidth: 420,
                  }}
                >
                  {reserveTeamNameSlotMulti ? (
                    <div
                      style={{
                        ...teamNameSlotMultiStyle,
                        color: winnerIndex === sideIdx ? gold : '#fff',
                      }}
                    >
                      {side.teamName || '\u00a0'}
                    </div>
                  ) : side.teamName ? (
                    <div style={{ fontWeight: 800, color: winnerIndex === sideIdx ? gold : '#fff', fontSize: 15, textAlign: 'center' }}>{side.teamName}</div>
                  ) : null}
                  <TeammateRow
                    slugs={side.slugs}
                    winnerIndex={winnerIndex}
                    sideIdx={sideIdx}
                    wrestlerMap={wrestlerMap}
                    events={events}
                    match={match}
                    event={event}
                    matchIndex={matchIndex}
                  />
                </div>
              </React.Fragment>
            ))}
          </div>
        )
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            justifyContent: 'center',
            gap: 16,
            flexWrap: 'wrap',
            width: '100%',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
            {reserveTeamNameSlotVs ? (
              <div style={{ ...teamNameSlotVsStyle, color: winnerIndex === 0 ? gold : '#fff' }}>{sides[0]?.teamName || '\u00a0'}</div>
            ) : (
              sides[0]?.teamName && (
                <div style={{ fontWeight: 800, color: winnerIndex === 0 ? gold : '#fff', fontSize: 17, textAlign: 'center' }}>{sides[0].teamName}</div>
              )
            )}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <TeammateRow
                slugs={sides[0]?.slugs || []}
                winnerIndex={winnerIndex}
                sideIdx={0}
                wrestlerMap={wrestlerMap}
                events={events}
                match={match}
                event={event}
                matchIndex={matchIndex}
              />
            </div>
          </div>
          <div style={{ alignSelf: 'center', fontSize: 18, fontWeight: 800, color: gold, padding: '0 8px', flexShrink: 0 }}>VS</div>
          <div style={{ flex: 1, minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
            {reserveTeamNameSlotVs ? (
              <div style={{ ...teamNameSlotVsStyle, color: winnerIndex === 1 ? gold : '#fff' }}>{sides[1]?.teamName || '\u00a0'}</div>
            ) : (
              sides[1]?.teamName && (
                <div style={{ fontWeight: 800, color: winnerIndex === 1 ? gold : '#fff', fontSize: 17, textAlign: 'center' }}>{sides[1].teamName}</div>
              )
            )}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
              <TeammateRow
                slugs={sides[1]?.slugs || []}
                winnerIndex={winnerIndex}
                sideIdx={1}
                wrestlerMap={wrestlerMap}
                events={events}
                match={match}
                event={event}
                matchIndex={matchIndex}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

