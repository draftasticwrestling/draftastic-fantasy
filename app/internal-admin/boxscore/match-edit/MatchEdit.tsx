// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import {
  MATCH_TYPE_OPTIONS,
  STIPULATION_OPTIONS,
  METHOD_OPTIONS,
  TITLE_OPTIONS,
  SPECIAL_WINNER_OPTIONS,
  TITLE_OUTCOME_OPTIONS,
  PROMO_OUTCOME_OPTIONS,
} from '@/lib/boxscoreAdmin/boxscoreMatchOptions';
import {
  MAIN_ROSTER_CALL_UP_POINTS,
  MAIN_ROSTER_CALL_UP_PROMO_OUTCOME,
} from '@/lib/scoring/mainRosterCallUp.js';
import { persistEventMatchCommentaryAction } from '@/app/internal-admin/boxscore/events/commentaryActions';

import WrestlerAutocomplete from './WrestlerAutocomplete';
import VisualMatchBuilder from './VisualMatchBuilder';
import GauntletMatchBuilder from './GauntletMatchBuilder';
import TagTeamGauntletMatchBuilder from './TagTeamGauntletMatchBuilder';
import TwoOutOfThreeFallsBuilder from './TwoOutOfThreeFallsBuilder';
import WarGamesMatchBuilder from './WarGamesMatchBuilder';
import SurvivorSeriesMatchBuilder from './SurvivorSeriesMatchBuilder';

const labelStyle = { color: '#fff', fontWeight: 500, marginBottom: 4, display: 'block' };
const inputStyle = {
  width: '100%',
  padding: '8px',
  borderRadius: '4px',
  border: '1px solid #444',
  background: '#222',
  color: '#fff',
  marginBottom: '12px',
};

const gold = '#C6A04F';

/** Map stored promoOutcome (possibly a custom string) to select + Other field state */
function getPromoOutcomeInitialState(initialMatch) {
  const raw = (initialMatch.promoOutcome || 'None').trim();
  const storedOther = (initialMatch.promoOutcomeOther || '').trim();
  const standardNoOther = PROMO_OUTCOME_OPTIONS.filter(o => o !== 'Other');
  if (raw === 'None' || !raw) {
    return { promoOutcome: 'None', promoOutcomeOther: '' };
  }
  if (raw === 'Other') {
    return { promoOutcome: 'Other', promoOutcomeOther: storedOther };
  }
  if (standardNoOther.includes(raw)) {
    return { promoOutcome: raw, promoOutcomeOther: '' };
  }
  // Free-text outcome was stored in promoOutcome (after save it is no longer the literal "Other")
  return { promoOutcome: 'Other', promoOutcomeOther: raw };
}

/**
 * Promo editor is a separate component so hooks stay valid (no early return before other MatchEdit hooks).
 * Save merges into initialMatch so order, cardType, commentary, etc. are never dropped vs internal match state.
 */
export function PromoMatchEdit({
  initialMatch = {},
  onSave,
  onCancel,
  wrestlers,
  variant = 'edit',
}: {
  initialMatch?: Record<string, unknown>;
  onSave: (match: Record<string, unknown>) => void;
  onCancel: () => void;
  wrestlers: { id: string; name: string }[];
  variant?: 'add' | 'edit';
}) {
  const isAdd = variant === 'add';
  const safeWrestlers = Array.isArray(wrestlers) ? wrestlers : [];
  const [promoTitle, setPromoTitle] = useState(() => initialMatch.title || '');
  const [promoParticipants, setPromoParticipants] = useState(() =>
    Array.isArray(initialMatch.participants) && initialMatch.participants.length > 0
      ? [...initialMatch.participants]
      : ['']
  );
  const [promoNotes, setPromoNotes] = useState(() => initialMatch.notes || '');
  const outcomeInit = getPromoOutcomeInitialState(initialMatch);
  const [promoOutcome, setPromoOutcome] = useState(() => outcomeInit.promoOutcome);
  const [promoOutcomeOther, setPromoOutcomeOther] = useState(() => outcomeInit.promoOutcomeOther);

  const handleSavePromo = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const trimmedTitle = promoTitle.trim();
    if (!trimmedTitle) {
      alert('Please enter a promo type/title.');
      return;
    }

    const resolvedOutcome =
      promoOutcome === 'Other' && promoOutcomeOther.trim()
        ? promoOutcomeOther.trim()
        : (promoOutcome || 'None');

    const updatedMatch = {
      ...initialMatch,
      matchType: 'Promo',
      participants: Array.isArray(promoParticipants) ? promoParticipants.filter(Boolean) : [],
      title: trimmedTitle,
      notes: promoNotes.trim(),
      promoOutcome: resolvedOutcome,
      promoOutcomeOther: promoOutcome === 'Other' ? promoOutcomeOther.trim() : '',
      result: '',
      method: '',
      time: '',
      stipulation: 'None',
      specialWinnerType: '',
      titleOutcome: '',
      defendingChampion: '',
    };

    onSave(updatedMatch);
  };

  return (
    <div>
      <h3 style={{ color: gold, marginBottom: 16 }}>{isAdd ? 'Add Promo' : 'Edit Promo / Segment'}</h3>
      {/* No nested <form> — sits inside Edit Event's server <form>. */}
      <div
        role="group"
        aria-label={isAdd ? "Add promo" : "Edit promo"}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
            handleSavePromo(e);
          }
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>
            Promo Type:
          </label>
          <select
            value={promoTitle}
            onChange={e => setPromoTitle(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select promo type...</option>
            <option value="In-Ring Promo">In-Ring Promo</option>
            <option value="Backstage Promo">Backstage Promo</option>
            <option value="Vingette">Vingette</option>
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, color: '#fff', fontWeight: 500 }}>
            Participant(s):
          </div>
          {Array.isArray(promoParticipants) && promoParticipants.map((id, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <WrestlerAutocomplete
                  wrestlers={safeWrestlers}
                  value={id}
                  onChange={val =>
                    setPromoParticipants(prev =>
                      prev.map((p, i) => (i === idx ? val : p))
                    )
                  }
                  placeholder={`Participant ${idx + 1}`}
                />
              </div>
              {promoParticipants.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setPromoParticipants(prev => prev.filter((_, i) => i !== idx))
                  }
                  style={{
                    background: '#d32f2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                  aria-label="Remove participant"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setPromoParticipants(prev => [...prev, ''])
            }
            style={{
              marginTop: 4,
              background: '#C6A04F',
              color: '#232323',
              border: 'none',
              borderRadius: 4,
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            + Add Participant
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>
            Promo Summary:
          </label>
          <textarea
            value={promoNotes}
            onChange={e => setPromoNotes(e.target.value)}
            style={{ ...inputStyle, minHeight: 80 }}
            placeholder="Brief summary of what happened in this promo or segment."
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>
            Promo Outcome:
          </label>
          <select
            value={promoOutcome || 'None'}
            onChange={e => setPromoOutcome(e.target.value)}
            style={inputStyle}
          >
            {PROMO_OUTCOME_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {promoOutcome === MAIN_ROSTER_CALL_UP_PROMO_OUTCOME && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#aaa', lineHeight: 1.45 }}>
              Each participant listed above receives a one-time <strong style={{ color: '#ddd' }}>{MAIN_ROSTER_CALL_UP_POINTS} fantasy points</strong> on this event date.
            </p>
          )}
        </div>

        {promoOutcome === 'Other' && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>
              Describe Outcome:
            </label>
            <input
              type="text"
              value={promoOutcomeOther}
              onChange={e => setPromoOutcomeOther(e.target.value)}
              style={inputStyle}
              placeholder="Describe what this promo accomplished..."
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={handleSavePromo}
            style={{ flex: 1, background: '#C6A04F', color: '#232323', border: 'none', borderRadius: 4, padding: 10, fontWeight: 700, cursor: 'pointer' }}
          >
            {isAdd ? 'Add Promo' : 'Save Promo'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{ flex: 1, background: '#555', color: '#fff', border: 'none', borderRadius: 4, padding: 10, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MatchEdit({
  initialMatch = {},
  onSave,
  onCancel,
  eventStatus,
  eventDate,
  onRealTimeCommentaryUpdate = undefined,
  eventId,
  matchOrder,
  wrestlers,
  initialTagTeamData,
  stipulationOptions,
  specialWinnerOptions,
  variant = 'edit',
}) {
  const isAdd = variant === 'add';
  const stipulationOptionsResolved =
    Array.isArray(stipulationOptions) && stipulationOptions.length > 0
      ? stipulationOptions
      : [...STIPULATION_OPTIONS];
  const specialWinnerOptionsResolved =
    Array.isArray(specialWinnerOptions) && specialWinnerOptions.length > 0
      ? specialWinnerOptions
      : [...SPECIAL_WINNER_OPTIONS];

  // Debug: Log the initialMatch object (only on mount)
  useEffect(() => {
    console.log('MatchEdit initialMatch debug - liveStart:', initialMatch.liveStart);
    console.log('MatchEdit initialMatch debug - isLive:', initialMatch.isLive);
    console.log('MatchEdit initialMatch debug - commentary:', initialMatch.commentary);
  }, []);
  
  const safeWrestlers = Array.isArray(wrestlers) ? wrestlers : [];
  // A live event should not default a statusless match to "live"; matches go live only when
  // an admin explicitly selects it. Live shows default new matches to "upcoming".
  const defaultStatusFromEvent = eventStatus === 'live' ? 'upcoming' : eventStatus;
  const [match, setMatch] = useState({
    participants: '',
    result: '',
    method: '',
    time: '',
    matchType: 'Singles Match',
    stipulation: 'None',
    customStipulation: '',
    title: '',
    specialWinnerType: '',
    titleOutcome: '',
    defendingChampion: '',
    notes: '',
    status: initialMatch.status || defaultStatusFromEvent || 'completed',
    cardType: initialMatch.cardType || 'Undercard',
    ...initialMatch,
  });
  const [status, setStatus] = useState(initialMatch.status || defaultStatusFromEvent || 'completed');
  const [resultType, setResultType] = useState('');
  const [winner, setWinner] = useState('');
  const [winnerOptions, setWinnerOptions] = useState([]);
  const [isLive, setIsLive] = useState(initialMatch.isLive || false);
  const [liveStart, setLiveStart] = useState(initialMatch.liveStart || null);
  const [liveEnd, setLiveEnd] = useState(initialMatch.liveEnd || null);
  const [commentary, setCommentary] = useState(Array.isArray(initialMatch.commentary) ? initialMatch.commentary : []);
  const [commentaryInput, setCommentaryInput] = useState("");
  const [liveMode, setLiveMode] = useState(isLive && (liveStart || !status || status === 'upcoming'));
  const [matchDetailsSaved, setMatchDetailsSaved] = useState(false);
  const [editingCommentIdx, setEditingCommentIdx] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [useVisualBuilder, setUseVisualBuilder] = useState(true);
  const [isAddingCommentary, setIsAddingCommentary] = useState(false);

  const effectiveStatus = status || eventStatus || 'completed';
  const isSurvivorSeriesMatch =
    match.matchType === 'Survivor Series-style 10-man Tag Team Elimination match' ||
    (typeof match.matchType === 'string' && match.matchType.includes('Survivor Series'));
  const isWarGamesMatch =
    match.matchType === '5-on-5 War Games Match' ||
    (typeof match.matchType === 'string' && match.matchType.includes('War Games'));

  // Auto-sync isLive with status (now controlled by Begin Match button)
  useEffect(() => {
    // isLive is now controlled by the Begin Match button, not the status dropdown
    // This effect is kept for backward compatibility but doesn't auto-sync anymore
  }, [status, isLive]);

  // Battle Royal specific state
  const [numParticipants, setNumParticipants] = useState(() => {
    if (Array.isArray(initialMatch.participants)) {
      return initialMatch.participants.length;
    }
    return 10;
  });
  const [brParticipants, setBrParticipants] = useState(() => {
    if (Array.isArray(initialMatch.participants)) {
      return [...initialMatch.participants];
    }
    return Array(10).fill('');
  });
  const [brWinner, setBrWinner] = useState(initialMatch.winner || '');
  const [brEliminations, setBrEliminations] = useState(() => {
    if (initialMatch.battleRoyalData && Array.isArray(initialMatch.battleRoyalData.eliminations)) {
      // Deep clone to preserve all properties including eliminatedBy2
      return initialMatch.battleRoyalData.eliminations.map(elim => ({ ...elim }));
    }
    return [];
  });

  // Royal Rumble specific state
  const [rrParticipants, setRrParticipants] = useState(() => {
    if (Array.isArray(initialMatch.participants) && initialMatch.participants.length === 30) {
      return [...initialMatch.participants];
    }
    return Array(30).fill('');
  });
  const [rrWinner, setRrWinner] = useState(initialMatch.winner || '');
  const [rrEliminations, setRrEliminations] = useState(() => {
    if (initialMatch.royalRumbleData && Array.isArray(initialMatch.royalRumbleData.eliminations)) {
      return initialMatch.royalRumbleData.eliminations.map(elim => ({ ...elim }));
    }
    return [];
  });
  const [rrOfficialTimes, setRrOfficialTimes] = useState(() => {
    if (initialMatch.royalRumbleData && Array.isArray(initialMatch.royalRumbleData.entryOrder)) {
      return initialMatch.royalRumbleData.entryOrder.map(entry => entry.timeInRing || '');
    }
    return Array(30).fill('');
  });
  const [rrManualIronman, setRrManualIronman] = useState(
    (initialMatch.royalRumbleData && initialMatch.royalRumbleData.manualIronman) || ''
  );

  // Elimination Chamber: 6 participants (required); starters/pod/result optional
  const [ecParticipants, setEcParticipants] = useState(() => {
    if (initialMatch.eliminationChamberData && Array.isArray(initialMatch.eliminationChamberData.participants) && initialMatch.eliminationChamberData.participants.length === 6) {
      return [...initialMatch.eliminationChamberData.participants];
    }
    if (Array.isArray(initialMatch.participants) && initialMatch.participants.length === 6) {
      return [...initialMatch.participants];
    }
    if (initialMatch.eliminationChamberData && Array.isArray(initialMatch.eliminationChamberData.starters) && initialMatch.eliminationChamberData.podEntrants) {
      const s = initialMatch.eliminationChamberData.starters;
      const p = initialMatch.eliminationChamberData.podEntrants;
      if (s.length === 2 && p.length === 4) return [...s, ...p];
    }
    return Array(6).fill('');
  });
  const [ecStarter1, setEcStarter1] = useState(() => {
    if (initialMatch.eliminationChamberData && Array.isArray(initialMatch.eliminationChamberData.starters) && initialMatch.eliminationChamberData.starters.length >= 1) {
      return initialMatch.eliminationChamberData.starters[0] || '';
    }
    return '';
  });
  const [ecStarter2, setEcStarter2] = useState(() => {
    if (initialMatch.eliminationChamberData && Array.isArray(initialMatch.eliminationChamberData.starters) && initialMatch.eliminationChamberData.starters.length >= 2) {
      return initialMatch.eliminationChamberData.starters[1] || '';
    }
    return '';
  });
  const [ecPodEntrants, setEcPodEntrants] = useState(() => {
    const ec = initialMatch.eliminationChamberData;
    if (ec && Array.isArray(ec.podEntrants) && ec.podEntrants.length > 0) {
      const arr = [...ec.podEntrants];
      while (arr.length < 4) arr.push('');
      return arr.slice(0, 4);
    }
    if (ec && Array.isArray(ec.entryOrder) && ec.entryOrder.length > 0) {
      const arr = ec.entryOrder.map(entry => entry.slug || '').filter(Boolean);
      while (arr.length < 4) arr.push('');
      return arr.slice(0, 4);
    }
    return Array(4).fill('');
  });
  const [ecPodEntryTimes, setEcPodEntryTimes] = useState(() => {
    if (initialMatch.eliminationChamberData && Array.isArray(initialMatch.eliminationChamberData.entryOrder)) {
      const times = initialMatch.eliminationChamberData.entryOrder.map(entry => entry.entryTime || '');
      while (times.length < 4) times.push('');
      return times.slice(0, 4);
    }
    return Array(4).fill('');
  });
  const [ecWinner, setEcWinner] = useState(initialMatch.winner || '');
  const [ecEliminations, setEcEliminations] = useState(() => {
    if (initialMatch.eliminationChamberData && Array.isArray(initialMatch.eliminationChamberData.eliminations)) {
      return initialMatch.eliminationChamberData.eliminations.map(elim => ({ ...elim }));
    }
    return [];
  });
  const [ecManualIronman, setEcManualIronman] = useState(
    (initialMatch.eliminationChamberData && initialMatch.eliminationChamberData.manualIronman) || ''
  );

  // Define isBattleRoyal early to avoid "Cannot access before initialization" error
  const isBattleRoyal = match.matchType === 'Battle Royal' || match.stipulation === 'Battle Royal';
  const isRoyalRumble = match.matchType === 'Royal Rumble' || match.stipulation === 'Royal Rumble';
  const isEliminationChamber = match.matchType === 'Elimination Chamber' || match.stipulation === 'Elimination Chamber';
  
  // Debug logging for Battle Royal matches
  useEffect(() => {
    if (isBattleRoyal) {
      console.log('🔵 MatchEdit - Battle Royal match detected');
      console.log('🔵 MatchEdit - brEliminations:', JSON.stringify(brEliminations, null, 2));
      const elimsWithSecond = brEliminations.filter(e => e.eliminatedBy2);
      if (elimsWithSecond.length > 0) {
        console.log('🔵 MatchEdit - eliminations WITH eliminatedBy2:', JSON.stringify(elimsWithSecond, null, 2));
      }
    }
  }, [isBattleRoyal, brEliminations]);

  useEffect(() => {
    setMatch(m => ({ ...m, status }));
  }, [status]);

  useEffect(() => {
    if (typeof match.participants === 'string' && match.participants.includes(' vs ')) {
      // Parse participants to get team names for winner selection
      const { participants, tagTeams } = parseParticipantsWithTagTeams(match.participants);
      const teamNames = participants.map((team, index) => {
        const tagTeamName = tagTeams[index];
        if (tagTeamName) {
          return tagTeamName; // Use tag team name for winner selection
        } else {
          // Fall back to individual names joined with '&'
          return team.join(' & ');
        }
      });
      setWinnerOptions(teamNames);
    } else {
      setWinnerOptions([]);
    }
  }, [match.participants]);

  // Auto-set winner from last elimination (use first eliminator if there are two)
  useEffect(() => {
    if (isBattleRoyal && brEliminations.length > 0) {
      const lastElimination = brEliminations[brEliminations.length - 1];
      if (lastElimination.eliminatedBy && !brWinner) {
        setBrWinner(lastElimination.eliminatedBy);
      }
    }
  }, [brEliminations, isBattleRoyal, brWinner]);

  useEffect(() => {
    // Don't set resultType for Battle Royal matches - they use their own winner selection
    if (!isBattleRoyal && initialMatch && initialMatch.result) {
      setResultType(initialMatch.result.includes('def.') ? 'Winner' : 'No Winner');
      if (winnerOptions.length && initialMatch.result && typeof match.participants === 'string') {
        // Prefer winner parsed from result string (same as Match Details display) so edit form matches what user sees
        const resultHasDef = initialMatch.result.includes(' def. ');
        const winnerFromResult = resultHasDef ? initialMatch.result.split(' def. ')[0].trim() : null;
        if (winnerFromResult && winnerOptions.length > 0) {
          if (winnerOptions.includes(winnerFromResult)) {
            setWinner(winnerFromResult);
            return;
          }
          const byName = safeWrestlers?.find(w => (w.name || '').trim() === winnerFromResult);
          if (byName?.id && winnerOptions.includes(byName.id)) {
            setWinner(byName.id);
            return;
          }
          const normalize = (s) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
          const matchOpt = winnerOptions.find(opt => normalize(opt) === normalize(winnerFromResult));
          if (matchOpt) {
            setWinner(matchOpt);
            return;
          }
        }
        // Fallback: use stored winner if it matches an option
        const storedWinner = initialMatch.winner;
        if (storedWinner && winnerOptions.length > 0) {
          if (winnerOptions.includes(storedWinner)) {
            setWinner(storedWinner);
            return;
          }
          const bySlug = safeWrestlers?.find(w => w.id === storedWinner);
          if (bySlug?.name && winnerOptions.includes(bySlug.name)) {
            setWinner(bySlug.name);
            return;
          }
        }
        // Last resort: infer from result by matching participant strings
        const { participants, tagTeams } = parseParticipantsWithTagTeams(match.participants);
        let found = null;
        for (let i = 0; i < participants.length; i++) {
          const tagTeamName = tagTeams[i];
          if (tagTeamName && initialMatch.result.includes(tagTeamName)) {
            found = tagTeamName;
            break;
          }
        }
        if (!found) {
          for (let i = 0; i < participants.length; i++) {
            const team = participants[i];
            for (const participant of team) {
              if (initialMatch.result.includes(participant)) {
                found = team.join(' & ');
                break;
              }
            }
            if (found) break;
          }
        }
        if (found && winnerOptions.includes(found)) {
          setWinner(found);
        }
      }
    }
  }, [initialMatch, winnerOptions, match.participants]);

  function isMethodRequired() {
    return effectiveStatus === 'completed' && resultType === 'Winner';
  }

  function getElapsedMinutes(ts) {
    if (!ts || !liveStart) return 0;
    return Math.floor((ts - liveStart) / 60000);
  }

  function formatCommentaryTime(ts, liveStart, commentary) {
    if (!ts || !liveStart) return '0\'';
    const elapsed = Math.floor((ts - liveStart) / 1000);
    const minutes = Math.floor(elapsed / 60);
    return `${minutes}'`;
  }

  const handleSaveMatchDetails = (e) => {
    e.preventDefault();
    setMatchDetailsSaved(true);
  };

  const handleBeginMatch = async () => {
    const startTime = Date.now();
    setStatus('live');
    setIsLive(true);
    setLiveStart(startTime);
    
    // Add the first commentary automatically
    const firstComment = {
      text: "The match begins",
      timestamp: startTime
    };
    
    const updatedCommentary = [firstComment];
    setCommentary(updatedCommentary);
    
    // Update in real-time
    if (onRealTimeCommentaryUpdate && eventId && matchOrder) {
      const updatedMatch = {
        ...match,
        status: 'live',
        isLive: true,
        liveStart: startTime,
        commentary: updatedCommentary
      };
      onRealTimeCommentaryUpdate(eventId, matchOrder, updatedMatch);
    }
    
    // Update in Supabase
    await updateMatchCommentaryInSupabase(eventId, matchOrder, updatedCommentary, startTime);
  };

  const handleEndMatch = async () => {
    const endTime = Date.now();
    setLiveEnd(endTime);
    setStatus('completed');
    setIsLive(false);
    
    // Add the final commentary automatically
    const finalComment = {
      text: "The match ends",
      timestamp: endTime
    };
    
    const updatedCommentary = [finalComment, ...(Array.isArray(commentary) ? commentary : [])];
    setCommentary(updatedCommentary);
    
    // Update in real-time
    if (onRealTimeCommentaryUpdate && eventId && matchOrder) {
      const updatedMatch = {
        ...match,
        liveEnd: endTime,
        status: 'completed',
        isLive: false,
        commentary: updatedCommentary
      };
      onRealTimeCommentaryUpdate(eventId, matchOrder, updatedMatch);
    }
    
    // Update in Supabase
    await updateMatchCommentaryInSupabase(eventId, matchOrder, updatedCommentary);
  };

  const handleSave = (e) => {
    e.preventDefault();
    console.log('🔴🔴🔴 handleSave STARTING 🔴🔴🔴');
    const saveStatus = status || eventStatus || 'completed';
    
    try {
    let result = '';
    
    // --- Battle Royal branch ---
    if (isBattleRoyal) {
      console.log('Battle Royal branch executing');
      if (saveStatus === 'completed' && brWinner) {
        const winnerName = safeWrestlers.find(w => w.id === brWinner)?.name || brWinner;
        const participants = Array.isArray(brParticipants) ? brParticipants.filter(Boolean).map(slug => 
          safeWrestlers.find(w => w.id === slug)?.name || slug
        ) : [];
        
        // Format eliminations if they exist
        let eliminationsText = '';
        if (brEliminations && Array.isArray(brEliminations) && brEliminations.length > 0) {
          const validEliminations = brEliminations.filter(e => e.eliminated && e.eliminatedBy);
          if (validEliminations.length > 0) {
            const elimStrings = validEliminations.map(elim => {
              const eliminatedName = safeWrestlers.find(w => w.id === elim.eliminated)?.name || elim.eliminated;
              const eliminatedByName = safeWrestlers.find(w => w.id === elim.eliminatedBy)?.name || elim.eliminatedBy;
              const eliminatedByName2 = elim.eliminatedBy2 ? safeWrestlers.find(w => w.id === elim.eliminatedBy2)?.name || elim.eliminatedBy2 : null;
              if (eliminatedByName2) {
                return `${eliminatedByName} & ${eliminatedByName2} eliminated ${eliminatedName}${elim.time ? ` (${elim.time})` : ''}`;
              }
              return eliminatedByName ? `${eliminatedByName} eliminated ${eliminatedName}${elim.time ? ` (${elim.time})` : ''}` : eliminatedName;
            });
            eliminationsText = ` [Eliminations: ${elimStrings.join(' → ')}]`;
          }
        }
        
        result = `${winnerName} won the Battle Royal${eliminationsText}`;
        console.log('Battle Royal result generated:', result);
        console.log('Eliminations text:', eliminationsText);
      } else if (saveStatus === 'completed') {
        result = 'No winner';
      }
    } else if (isRoyalRumble) {
      // --- Royal Rumble branch ---
      console.log('Royal Rumble branch executing');
      if (saveStatus === 'completed' && rrWinner) {
        const winnerName = safeWrestlers.find(w => w.id === rrWinner)?.name || rrWinner;
        
        // Format eliminations if they exist
        let eliminationsText = '';
        if (rrEliminations && Array.isArray(rrEliminations) && rrEliminations.length > 0) {
          const validEliminations = rrEliminations.filter(e => e.eliminated && e.eliminatedBy);
          if (validEliminations.length > 0) {
            const elimStrings = validEliminations.map(elim => {
              const eliminatedName = safeWrestlers.find(w => w.id === elim.eliminated)?.name || elim.eliminated;
              const eliminatedByName = safeWrestlers.find(w => w.id === elim.eliminatedBy)?.name || elim.eliminatedBy;
              const eliminatedByName2 = elim.eliminatedBy2 ? safeWrestlers.find(w => w.id === elim.eliminatedBy2)?.name || elim.eliminatedBy2 : null;
              if (eliminatedByName2) {
                return `${eliminatedByName} & ${eliminatedByName2} eliminated ${eliminatedName}${elim.time ? ` (${elim.time})` : ''}`;
              }
              return eliminatedByName ? `${eliminatedByName} eliminated ${eliminatedName}${elim.time ? ` (${elim.time})` : ''}` : eliminatedName;
            });
            eliminationsText = ` [Eliminations: ${elimStrings.join(' → ')}]`;
          }
        }
        
        result = `${winnerName} won the Royal Rumble${eliminationsText}`;
      } else if (saveStatus === 'completed') {
        result = 'No winner';
      }
    } else if (isEliminationChamber) {
      // --- Elimination Chamber branch ---
      console.log('Elimination Chamber branch executing');
      if (saveStatus === 'completed' && ecWinner) {
        const winnerName = safeWrestlers.find(w => w.id === ecWinner)?.name || ecWinner;
        
        // Format eliminations if they exist
        let eliminationsText = '';
        if (ecEliminations && Array.isArray(ecEliminations) && ecEliminations.length > 0) {
          const validEliminations = ecEliminations.filter(e => e.eliminated && (e.eliminatedBy || e.method === 'Referee decision'));
          if (validEliminations.length > 0) {
            const elimStrings = validEliminations.map(elim => {
              const eliminatedName = safeWrestlers.find(w => w.id === elim.eliminated)?.name || elim.eliminated;
              const methodPart = elim.method ? ` (${elim.method})` : '';
              const timePart = elim.time ? ` at ${elim.time}` : '';
              if (elim.method === 'Referee decision' && !elim.eliminatedBy) {
                return `${eliminatedName} eliminated${methodPart}${timePart}`;
              }
              const eliminatedByName = safeWrestlers.find(w => w.id === elim.eliminatedBy)?.name || elim.eliminatedBy;
              const eliminatedByName2 = elim.eliminatedBy2 ? safeWrestlers.find(w => w.id === elim.eliminatedBy2)?.name || elim.eliminatedBy2 : null;
              if (eliminatedByName2) {
                return `${eliminatedByName} & ${eliminatedByName2} eliminated ${eliminatedName}${methodPart}${timePart}`;
              }
              return eliminatedByName ? `${eliminatedByName} eliminated ${eliminatedName}${methodPart}${timePart}` : eliminatedName;
            });
            eliminationsText = ` [Eliminations: ${elimStrings.join(' → ')}]`;
          }
        }

        result = `${winnerName} won the Elimination Chamber${eliminationsText}`;
      } else if (saveStatus === 'completed') {
        result = 'No winner';
      }
    } else {
      // --- Default (non-Battle Royal) branch ---
      if (saveStatus === 'completed' && resultType === 'Winner' && winner && winnerOptions.length >= 2) {
        const { participants, tagTeams } = parseParticipantsWithTagTeams(match.participants);
        const winnerIndex = winnerOptions.indexOf(winner);
        if (winnerIndex !== -1) {
          const winnerTeam = participants[winnerIndex];
          const loserTeams = participants.filter((_, index) => index !== winnerIndex);
          const winnerName = tagTeams[winnerIndex] || winnerTeam.join(' & ');
          const loserNames = loserTeams.map((team, index) => {
            const actualIndex = index >= winnerIndex ? index + 1 : index;
            return tagTeams[actualIndex] || team.join(' & ');
          });
          result = `${winnerName} def. ${loserNames.join(' & ')}`;
        }
      } else if (saveStatus === 'completed' && resultType === 'No Winner') {
        result = 'No winner';
      }
    }

    // For Gauntlet Match, 2 out of 3 Falls, War Games, and Survivor Series, preserve the existing result
    // NOTE: Battle Royal is NOT in this list, so it always regenerates the result
    if (match.matchType === 'Gauntlet Match' || match.matchType === 'Tag Team Gauntlet Match' || match.matchType === '2 out of 3 Falls' || match.matchType === '5-on-5 War Games Match' || match.matchType === 'Survivor Series-style 10-man Tag Team Elimination match' || match.matchType?.includes('Survivor Series')) {
      result = match.result || result;
    }
    // Never overwrite a stored result with empty when user only changed summary/commentary/etc.
    if (initialMatch && initialMatch.result && !result) {
      result = initialMatch.result;
    }
    const isGauntletOr2o3 = match.matchType === 'Gauntlet Match' || match.matchType === 'Tag Team Gauntlet Match' || match.matchType === '2 out of 3 Falls';
    const isStandardMatch = !isBattleRoyal && !isRoyalRumble && !isEliminationChamber && !isGauntletOr2o3 &&
      match.matchType !== '5-on-5 War Games Match' && match.matchType !== 'Survivor Series-style 10-man Tag Team Elimination match' && !match.matchType?.includes('Survivor Series');
    // Standard matches: if form would save a different result but winner wasn't set (init race), keep stored result
    let useStoredResultForStandard = false;
    if (initialMatch && initialMatch.result && isStandardMatch) {
      if (!result) {
        result = initialMatch.result;
        useStoredResultForStandard = true;
      } else if (result !== initialMatch.result && !winner) {
        result = initialMatch.result;
        useStoredResultForStandard = true;
      }
    }

    // If the match has a result, it should not be live.
    // Live state is controlled solely by the explicit isLive flag so that
    // switching status back to Upcoming can fully turn off "Match in progress".
    const shouldBeLive = isLive && !result;
    
    // Automatically set "Champion Retains" when champion loses by DQ or Count Out
    let titleOutcome = match.titleOutcome;
    if (saveStatus === 'completed' && match.title && match.title !== 'None' && match.defendingChampion) {
      const method = match.method?.toLowerCase() || '';
      const isDQOrCountOut = method === 'dq' || method === 'count out' || method === 'double count out';
      
      if (isDQOrCountOut && match.defendingChampion && winner) {
        // Normalize function for string comparison (same as MatchCard uses)
        const normalize = (str) => (str || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
        
        // Check if the winner is NOT the defending champion
        // If champion loses by DQ/Count Out, they retain
        const winnerStr = String(winner).trim();
        const defendingChampionStr = String(match.defendingChampion).trim();
        
        // Compare using normalized strings for better matching
        const winnerMatchesChampion = normalize(winnerStr) === normalize(defendingChampionStr) ||
          normalize(winnerStr).includes(normalize(defendingChampionStr)) ||
          normalize(defendingChampionStr).includes(normalize(winnerStr));
        
        if (!winnerMatchesChampion) {
          // Champion lost by DQ/Count Out, so they retain
          titleOutcome = 'Champion Retains';
        }
      }
    }
    
    const updatedMatch = {
      ...match,
      result,
      status: saveStatus,
      // Live state must come from the explicit isLive flag (status dropdown / Begin Match),
      // never inherited from the event being live. Otherwise every saved match on a live show
      // would render "MATCH IN PROGRESS" and earn on-card points without being marked live.
      isLive: shouldBeLive,
      liveStart,
      liveEnd,
      commentary,
      titleOutcome: titleOutcome || match.titleOutcome,
    };

    // Standard match: when we kept stored result, keep stored winner (and method/time if form had none)
    if (useStoredResultForStandard && initialMatch) {
      updatedMatch.result = initialMatch.result;
      if (initialMatch.winner != null) updatedMatch.winner = initialMatch.winner;
      if (initialMatch.method && !updatedMatch.method) updatedMatch.method = initialMatch.method;
      if (initialMatch.time != null && updatedMatch.time == null) updatedMatch.time = initialMatch.time;
    } else if (isStandardMatch) {
      // Persist the winner selected in the form (otherwise it's never saved and reverts to old value)
      updatedMatch.winner = winner || updatedMatch.winner;
    }

    // Store Battle Royal data (participants and eliminations)
    if (isBattleRoyal) {
      updatedMatch.participants = Array.isArray(brParticipants) ? brParticipants.filter(Boolean) : [];
      updatedMatch.winner = brWinner;
      // Always set battleRoyalData to preserve all elimination data including eliminatedBy2
      // Use spread operator to preserve ALL properties from the elimination objects
      const clonedEliminations = (brEliminations || []).map(elim => ({ ...elim }));
      
      // Debug: Log to verify eliminatedBy2 is preserved
      const elimsWithSecond = clonedEliminations.filter(elim => elim.eliminatedBy2);
      console.log('✅ MatchEdit handleSave - eliminations with eliminatedBy2:', elimsWithSecond.length);
      if (elimsWithSecond.length > 0) {
        console.log('✅ MatchEdit handleSave - eliminations with eliminatedBy2:', JSON.stringify(elimsWithSecond, null, 2));
      }
      console.log('✅ MatchEdit handleSave - ALL cloned eliminations:', JSON.stringify(clonedEliminations, null, 2));
      
      updatedMatch.battleRoyalData = {
        eliminations: clonedEliminations,
        participants: Array.isArray(brParticipants) ? brParticipants.filter(Boolean) : []
      };
      
      console.log('✅ MatchEdit handleSave - updatedMatch.battleRoyalData:', JSON.stringify(updatedMatch.battleRoyalData, null, 2));
    }
    
    // Store Royal Rumble data (participants, eliminations, and entry order)
    if (isRoyalRumble) {
      const rrPart = Array.isArray(rrParticipants) ? rrParticipants.filter(Boolean) : [];
      updatedMatch.participants = rrPart;
      updatedMatch.winner = rrWinner;
      
      // Calculate entry order (1-30 based on array index)
      const formatEntryTime = (entryIndex) => {
        const totalSeconds = entryIndex * 90; // 90 seconds per entry
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      };
      
      const entryOrder = rrPart.map((slug, index) => ({
        slug,
        entryNumber: index + 1,
        entryTime: formatEntryTime(index),
        timeInRing: (Array.isArray(rrOfficialTimes) ? rrOfficialTimes[index] : '') || null,
      }));
      
      const clonedEliminations = (rrEliminations || []).map(elim => ({ ...elim }));
      
    updatedMatch.royalRumbleData = {
      eliminations: clonedEliminations,
      participants: rrPart,
      entryOrder: entryOrder,
      manualIronman: rrManualIronman || null,
    };
    }
    
    // Store Elimination Chamber data (participants required; starters/pod/result optional)
    if (isEliminationChamber) {
      const allParticipants = Array.isArray(ecParticipants) ? ecParticipants.filter(Boolean) : [];
      const starters = [ecStarter1, ecStarter2].filter(Boolean);
      const podEntrants = Array.isArray(ecPodEntrants) ? ecPodEntrants.filter(Boolean) : [];
      
      const entryOrder = podEntrants.map((slug, index) => ({
        slug,
        entryNumber: index + 1,
        entryTime: (Array.isArray(ecPodEntryTimes) ? ecPodEntryTimes[index] : '') || ''
      }));
      
      updatedMatch.participants = allParticipants.length === 6 ? allParticipants : (updatedMatch.participants || []);
      updatedMatch.winner = ecWinner || updatedMatch.winner;
      
      const clonedEliminations = (ecEliminations || []).map(elim => ({ ...elim }));
      
      updatedMatch.eliminationChamberData = {
        participants: allParticipants.length === 6 ? allParticipants : (initialMatch.eliminationChamberData?.participants || []),
        starters,
        podEntrants,
        entryOrder,
        eliminations: clonedEliminations,
        manualIronman: ecManualIronman || null
      };
    }

    // Gauntlet / 2 out of 3 Falls: never overwrite stored result with empty form state
    if (isGauntletOr2o3 && initialMatch) {
      const progression = updatedMatch.gauntletProgression;
      const hasCompleteProgression = Array.isArray(progression) && progression.length > 0 &&
        progression.every(p => p && (p.winner || p.method));
      if (!hasCompleteProgression && Array.isArray(initialMatch.gauntletProgression) && initialMatch.gauntletProgression.length > 0) {
        updatedMatch.gauntletProgression = initialMatch.gauntletProgression;
        updatedMatch.winner = initialMatch.winner ?? updatedMatch.winner;
        updatedMatch.result = initialMatch.result ?? updatedMatch.result;
      }
    }

    console.log('✅ MatchEdit handleSave - calling onSave with updatedMatch');
    console.log('✅ MatchEdit handleSave - updatedMatch.battleRoyalData before onSave:', updatedMatch.battleRoyalData ? JSON.stringify(updatedMatch.battleRoyalData, null, 2) : 'null');
    onSave(updatedMatch);
    console.log('✅ MatchEdit handleSave - onSave called successfully');
    } catch (error) {
      console.error('❌ ERROR in handleSave:', error);
      throw error;
    }
  };

  async function updateMatchCommentaryInSupabase(eventId, matchOrder, newCommentary, newLiveStart = null) {
    if (!eventId) return;
    try {
      const res = await persistEventMatchCommentaryAction(
        eventId,
        matchOrder,
        newCommentary,
        newLiveStart != null ? newLiveStart : undefined
      );
      if (res?.error) console.error('Error updating commentary:', res.error);
    } catch (error) {
      console.error('Error updating commentary:', error);
    }
  }

  const handleAddCommentary = async (e) => {
    e.preventDefault();
    if (!commentaryInput.trim()) return;

    setIsAddingCommentary(true);

    try {
      // Use existing liveStart (Begin Match button should have set this)
      let newLiveStart = liveStart;
      if (!liveStart) {
        // Fallback: start the match timer if this is the first commentary
        newLiveStart = Date.now();
        setLiveStart(newLiveStart);
      }

      const newComment = {
        text: commentaryInput,
        timestamp: Date.now()
      };
      
          console.log('Adding commentary:', newComment.text, 'at timestamp:', newComment.timestamp);

      // Add new commentary to the beginning (newest first)
      const updatedCommentary = [newComment, ...(Array.isArray(commentary) ? commentary : [])];
      setCommentary(updatedCommentary);
      setCommentaryInput("");

      // Update in real-time
      if (onRealTimeCommentaryUpdate && eventId && matchOrder) {
        const updatedMatch = {
          ...match,
          commentary: updatedCommentary,
          liveStart: newLiveStart
        };
        onRealTimeCommentaryUpdate(eventId, matchOrder, updatedMatch);
      }

      // Update in Supabase
      await updateMatchCommentaryInSupabase(eventId, matchOrder, updatedCommentary, newLiveStart);
    } catch (error) {
      console.error('Error adding commentary:', error);
    } finally {
      setIsAddingCommentary(false);
    }
  };

  function parseParticipants(input) {
    if (!input) return [];
    return input.split(' vs ').map(side => 
      side.split(' & ').map(name => name.trim())
    );
  }

  function parseParticipantsWithTagTeams(input) {
    if (!input) return { participants: [], tagTeams: {} };
    
    const sides = input.split(' vs ');
    const participants = [];
    const tagTeams = {};
    
    sides.forEach((side, sideIndex) => {
      const names = side.split(' & ').map(name => name.trim());
      participants.push(names);
      
      // If there are multiple names, treat as tag team
      if (names.length > 1) {
        tagTeams[sideIndex] = names.join(' & ');
      }
    });
    
    return { participants, tagTeams };
  }

  // Function to get match structure from match type (copied from App.jsx)
  const getMatchStructureFromMatchType = (matchType) => {
    switch (matchType) {
      case 'Singles Match':
        return [
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] }
        ];
      case 'Tag Team':
        return [
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' }
        ];
      case 'Handicap Match (singles)':
        return [
          { type: 'individual', participants: [''] },
          { type: 'team', participants: ['', ''], name: '' }
        ];
      case 'Handicap Match (Tag)':
        return [
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' }
        ];
      case '3-way Tag Team':
        return [
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' }
        ];
      case '4-way Tag Team':
        return [
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' }
        ];
      case '5-team Tag Team':
        return [
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' }
        ];
      case '6-team Tag Team':
        return [
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' }
        ];
      case '6-person Tag Team':
        return [
          { type: 'team', participants: ['', '', ''], name: '' },
          { type: 'team', participants: ['', '', ''], name: '' }
        ];
      case '8-person Tag Team':
        return [
          { type: 'team', participants: ['', '', '', ''], name: '' },
          { type: 'team', participants: ['', '', '', ''], name: '' }
        ];
      case '10-man Tag Team':
        return [
          { type: 'team', participants: ['', '', '', '', ''], name: '' },
          { type: 'team', participants: ['', '', '', '', ''], name: '' }
        ];
      case 'Fatal Four-way match':
        return [
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] }
        ];
      case '5-way Match':
        return [
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] }
        ];
      case '6-way Match':
        return Array.from({ length: 6 }, () => ({ type: 'individual', participants: [''] }));
      case '7-way Match':
        return Array.from({ length: 7 }, () => ({ type: 'individual', participants: [''] }));
      case '8-way Match':
        return Array.from({ length: 8 }, () => ({ type: 'individual', participants: [''] }));
      case '9-way Match':
        return Array.from({ length: 9 }, () => ({ type: 'individual', participants: [''] }));
      case '10-way Match':
        return Array.from({ length: 10 }, () => ({ type: 'individual', participants: [''] }));
      case 'Triple Threat match':
        return [
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] }
        ];
      case 'Gauntlet Match':
        return [
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] }
        ];
      case 'Tag Team Gauntlet Match':
        return [
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' },
          { type: 'team', participants: ['', ''], name: '' }
        ];
      case '2 out of 3 Falls':
        // 2 out of 3 Falls: 2 individual participants who wrestle multiple falls
        return [
          { type: 'individual', participants: [''] },
          { type: 'individual', participants: [''] }
        ];
      case '5-on-5 War Games Match':
        // War Games: 2 teams with 5 participants each
        return [
          { type: 'team', participants: ['', '', '', '', ''], name: '' },
          { type: 'team', participants: ['', '', '', '', ''], name: '' }
        ];
      case 'Survivor Series-style 10-man Tag Team Elimination match':
        // Survivor Series: 2 teams with 5 participants each
        return [
          { type: 'team', participants: ['', '', '', '', ''], name: '' },
          { type: 'team', participants: ['', '', '', '', ''], name: '' }
        ];
      case 'Battle Royal':
        // Battle Royal uses separate interface, so return null
        return null;
      default:
        // For stipulations like "Hell in a Cell", "Bakersfield Brawl", etc.
        // Return null to let user build manually
        return null;
    }
  };

  // Parse existing match participants into VisualMatchBuilder structure
  const parseExistingMatchStructure = (match) => {
    console.log('parseExistingMatchStructure called with match:', match);
    if (!match.participants) {
      console.log('No participants found, returning null');
      return null;
    }

    // If participants is already an array (Battle Royal), return as is
    if (Array.isArray(match.participants)) {
      return [{ type: 'battle-royal', participants: match.participants }];
    }

    // If participants is a string, parse it
    if (typeof match.participants === 'string') {
      const participants = match.participants.trim();
      
      if (!participants) {
        return null;
      }

      // Check if it's a Gauntlet Match (contains arrows)
      if (participants.includes(' → ')) {
        const participantList = participants.split(' → ').filter(s => s.trim()).map(s => s.trim());
        return participantList.map(participant => ({
          type: 'individual',
          participants: [participant]
        }));
      }

      // Regular match format: side1 vs side2
      const sides = participants.split(' vs ').filter(s => s.trim());
      console.log('Split sides:', sides);
      
      const result = sides.map(side => {
        const teamMatch = side.match(/^([^(]+)\s*\(([^)]+)\)$/);
        if (teamMatch) {
          // Tag team with name
          const teamName = teamMatch[1].trim();
          const wrestlerSlugs = teamMatch[2].split('&').filter(s => s.trim()).map(s => s.trim());
          console.log('Found team with name:', teamName, 'wrestlers:', wrestlerSlugs);
          return { type: 'team', name: teamName, participants: wrestlerSlugs };
        } else {
          // Individual wrestlers - check if this should be a team based on match type
          const wrestlerSlugs = side.split('&').filter(s => s.trim()).map(s => s.trim());
          const isTagTeamMatch = match.matchType && (
            match.matchType.includes('Tag Team') || 
            match.matchType.includes('6-Man') || 
            match.matchType.includes('8-Man') || 
            (match.matchType.includes('10-Man') || match.matchType.includes('10-man')) || 
            match.matchType.includes('12-Man') ||
            match.matchType.includes('WarGames') ||
            match.matchType.includes('Survivor Series')
          );
          
          console.log('Side wrestlers:', wrestlerSlugs, 'isTagTeamMatch:', isTagTeamMatch);
          
          if (isTagTeamMatch && wrestlerSlugs.length > 1) {
            // Convert to team structure but without a name (user can add one)
            console.log('Converting to team structure without name');
            return { type: 'team', name: '', participants: wrestlerSlugs };
          } else {
            console.log('Keeping as individual structure');
            return { type: 'individual', participants: wrestlerSlugs };
          }
        }
      });
      
      console.log('Final parsed structure:', result);
      return result;
    }

    return null;
  };

  // UI rendering
  console.log('🔵 MatchEdit RENDER - isBattleRoyal:', isBattleRoyal);
  
  return (
    <div style={{ background: '#181818', padding: 24, borderRadius: 8, maxWidth: 500 }}>
      {/* Live Match Status Indicator */}
      {isLive && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#27ae60', borderRadius: 4, display: 'flex', alignItems: 'center' }}>
          <span style={{ color: 'white', fontWeight: 600, marginRight: 8 }}>🔴</span>
          <span style={{ color: 'white', fontWeight: 600 }}>LIVE MATCH</span>
        </div>
      )}
      <div>
        <label style={labelStyle}>Match Status:</label>
        <select
          style={inputStyle}
          value={status}
          onChange={(e) => {
            const newStatus = e.target.value;
            setStatus(newStatus);
            if (newStatus === 'live') setIsLive(true);
            if (newStatus === 'upcoming' || newStatus === 'completed') setIsLive(false);
          }}
        >
          <option value="upcoming">Upcoming</option>
          <option value="live">Live (in progress)</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div style={{ marginBottom: isAdd ? 16 : 12 }}>
        <label style={labelStyle}>Card Type:</label>
        <select
          value={match.cardType || 'Undercard'}
          onChange={(e) => setMatch({ ...match, cardType: e.target.value })}
          style={inputStyle}
        >
          <option value="Undercard">Undercard</option>
          <option value="Main Event">Main Event</option>
        </select>
      </div>
      <h2 style={{ color: '#C6A04F', marginBottom: 12 }}>{isAdd ? 'Add Match' : 'Edit Match'}</h2>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Match Type:</label>
        <select
          style={inputStyle}
          value={match.matchType}
          onChange={e => setMatch({ ...match, matchType: e.target.value })}
        >
          {MATCH_TYPE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Stipulation:</label>
        <select
          style={inputStyle}
          value={match.stipulation}
          onChange={e => setMatch({ ...match, stipulation: e.target.value, customStipulation: '' })}
        >
          {stipulationOptionsResolved.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      {match.stipulation === 'Custom/Other' && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Custom Stipulation:</label>
          <input
            style={inputStyle}
            value={match.customStipulation || ''}
            onChange={e => setMatch({ ...match, customStipulation: e.target.value })}
          />
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Title:</label>
        <select
          style={inputStyle}
          value={match.title || ''}
          onChange={e => setMatch({ ...match, title: e.target.value })}
        >
          {TITLE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      {match.matchType === 'Battle Royal' ? (
        <>
          <div>
            <label style={{ color: gold, fontWeight: 600 }}>Number of Participants:</label>
            <select value={numParticipants} onChange={e => {
              const n = parseInt(e.target.value, 10);
              setNumParticipants(n);
              setBrParticipants(prev => {
                const arr = prev.slice(0, n);
                while (arr.length < n) arr.push('');
                return arr;
              });
            }} style={inputStyle}>
              {Array.from({length: 21}, (_, i) => i + 10).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {Array.isArray(brParticipants) && brParticipants.slice(0, numParticipants).map((slug, i) => (
            <WrestlerAutocomplete
              key={i}
              wrestlers={safeWrestlers}
              value={slug}
              onChange={val => setBrParticipants(prev => Array.isArray(prev) ? prev.map((s, idx) => idx === i ? val : s) : [])}
              placeholder={`Participant ${i+1}`}
            />
          ))}
          {/* Eliminations Section */}
          {brParticipants.filter(Boolean).length >= 2 && (
            <div style={{ marginTop: 16, padding: 16, background: '#2a2a2a', borderRadius: 8, border: '1px solid #444' }}>
              <div style={{ color: gold, fontWeight: 'bold', marginBottom: 12 }}>
                Eliminations
              </div>
              <div style={{ color: '#fff', fontSize: 12, marginBottom: 12 }}>
                Track each elimination in order.
              </div>
              
              {brEliminations.map((elimination, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, background: '#333', borderRadius: 4, marginBottom: 8, border: '1px solid #555' }}>
                  <span style={{ color: '#fff', minWidth: '80px', fontSize: 12 }}>Elimination #{index + 1}:</span>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block' }}>
                      Eliminated:
                    </label>
                    <select
                      value={elimination.eliminated || ''}
                      onChange={(e) => {
                        const newEliminations = [...brEliminations];
                        newEliminations[index] = { ...newEliminations[index], eliminated: e.target.value };
                        setBrEliminations(newEliminations);
                      }}
                      style={inputStyle}
                    >
                      <option value="">Select wrestler...</option>
                      {brParticipants.filter(Boolean).filter(p => {
                        // Don't show already eliminated wrestlers (except in this current elimination)
                        const alreadyEliminated = brEliminations
                          .filter((_, i) => i !== index)
                          .map(e => e.eliminated)
                          .includes(p);
                        return !alreadyEliminated;
                      }).map(slug => (
                        <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block', flex: 1 }}>
                        Eliminated by:
                      </label>
                      {!elimination.eliminatedBy2 && (
                        <button
                          type="button"
                          onClick={() => {
                            console.log('🔵 MatchEdit - Adding second eliminator for index:', index);
                            const newEliminations = [...brEliminations];
                            newEliminations[index] = { ...newEliminations[index], eliminatedBy2: '' };
                            console.log('🔵 MatchEdit - Updated elimination:', JSON.stringify(newEliminations[index], null, 2));
                            setBrEliminations(newEliminations);
                          }}
                          style={{
                            background: gold,
                            color: '#232323',
                            border: 'none',
                            borderRadius: 4,
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 'bold',
                            height: 'fit-content'
                          }}
                          title="Add second eliminator"
                        >
                          +
                        </button>
                      )}
                    </div>
                    <select
                      value={elimination.eliminatedBy || ''}
                      onChange={(e) => {
                        const newEliminations = [...brEliminations];
                        newEliminations[index] = { ...newEliminations[index], eliminatedBy: e.target.value };
                        setBrEliminations(newEliminations);
                      }}
                      style={inputStyle}
                    >
                      <option value="">Select wrestler...</option>
                      {brParticipants.filter(Boolean).filter(p => p !== elimination.eliminated && p !== elimination.eliminatedBy2).map(slug => (
                        <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                      ))}
                    </select>
                    {elimination.eliminatedBy2 !== undefined && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block', flex: 1 }}>
                            Second eliminator:
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newEliminations = [...brEliminations];
                              const updatedElim = { ...newEliminations[index] };
                              delete updatedElim.eliminatedBy2;
                              newEliminations[index] = updatedElim;
                              setBrEliminations(newEliminations);
                            }}
                            style={{
                              background: '#d32f2f',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: 14,
                              fontWeight: 'bold',
                              height: 'fit-content'
                            }}
                            title="Remove second eliminator"
                          >
                            ×
                          </button>
                        </div>
                        <select
                          value={elimination.eliminatedBy2 || ''}
                          onChange={(e) => {
                            console.log('🔵 MatchEdit - Second eliminator changed:', e.target.value, 'for elimination index:', index);
                            const newEliminations = [...brEliminations];
                            newEliminations[index] = { ...newEliminations[index], eliminatedBy2: e.target.value };
                            console.log('🔵 MatchEdit - Updated elimination:', JSON.stringify(newEliminations[index], null, 2));
                            setBrEliminations(newEliminations);
                          }}
                          style={inputStyle}
                        >
                          <option value="">Select second wrestler...</option>
                          {brParticipants.filter(Boolean).filter(p => p !== elimination.eliminated && p !== elimination.eliminatedBy).map(slug => (
                            <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 0.8 }}>
                    <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block' }}>
                      Time:
                    </label>
                    <input
                      type="text"
                      value={elimination.time || ''}
                      onChange={(e) => {
                        const newEliminations = [...brEliminations];
                        newEliminations[index] = { ...newEliminations[index], time: e.target.value };
                        setBrEliminations(newEliminations);
                      }}
                      placeholder="e.g. 6:52"
                      style={inputStyle}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const newEliminations = brEliminations.filter((_, i) => i !== index);
                      setBrEliminations(newEliminations);
                    }}
                    style={{
                      background: '#d32f2f',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      height: 'fit-content',
                      marginTop: 20
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              {brEliminations.length < brParticipants.filter(Boolean).length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setBrEliminations([...brEliminations, { eliminated: '', eliminatedBy: '', time: '' }]);
                  }}
                  style={{
                    background: gold,
                    color: '#232323',
                    border: 'none',
                    borderRadius: 4,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginTop: 8
                  }}
                >
                  + Add Elimination
                </button>
              )}
            </div>
          )}

          {/* Winner Selection - After Eliminations */}
          {effectiveStatus === 'completed' && brParticipants.filter(Boolean).length >= 2 && (
            <div style={{ marginTop: 16 }}>
              <label style={{ color: gold, fontWeight: 600 }}>Winner:</label>
              <select 
                value={brWinner} 
                onChange={e => setBrWinner(e.target.value)} 
                style={inputStyle}
              >
                <option value="">Select winner</option>
                {Array.isArray(brParticipants) && brParticipants.filter(Boolean).map((slug, i) => {
                  // Auto-select if this is the last eliminator and no winner is set yet
                  const isLastEliminator = brEliminations.length > 0 && 
                    brEliminations[brEliminations.length - 1]?.eliminatedBy === slug;
                  return (
                    <option key={i} value={slug}>
                      {safeWrestlers.find(w => w.id === slug)?.name || slug}
                      {isLastEliminator && !brWinner ? ' (Last Eliminator)' : ''}
                    </option>
                  );
                })}
              </select>
              <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>
                The winner is typically the wrestler who eliminated the last opponent.
              </div>
            </div>
          )}
        </>
      ) : match.matchType === 'Royal Rumble' ? (
        <>
          <div style={{ color: gold, fontWeight: 600, marginBottom: 8 }}>
            Royal Rumble (30 Participants)
          </div>
          <div style={{ color: '#fff', fontSize: 12, marginBottom: 16 }}>
            Participants enter every 90 seconds. Entry #1 enters at 0:00, Entry #2 at 1:30, etc.
          </div>
          {Array.isArray(rrParticipants) && rrParticipants.map((slug, i) => {
            const entryNumber = i + 1;
            const entryTimeSeconds = i * 90;
            const entryMinutes = Math.floor(entryTimeSeconds / 60);
            const entrySeconds = entryTimeSeconds % 60;
            const entryTime = `${entryMinutes}:${entrySeconds.toString().padStart(2, '0')}`;
            const officialTime = Array.isArray(rrOfficialTimes) ? rrOfficialTimes[i] : '';
            
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ minWidth: 80, color: gold, fontWeight: 600, fontSize: 12 }}>
                  #{entryNumber} ({entryTime})
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <WrestlerAutocomplete
                    wrestlers={safeWrestlers}
                    value={slug}
                    onChange={val => setRrParticipants(prev => Array.isArray(prev) ? prev.map((s, idx) => idx === i ? val : s) : [])}
                    placeholder={`Entry #${entryNumber}`}
                  />
                  <input
                    type="text"
                    value={slug || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setRrParticipants(prev => Array.isArray(prev) ? prev.map((s, idx) => idx === i ? val : s) : []);
                    }}
                    placeholder="Or enter custom slug (e.g. surprise-entrant)"
                    style={{ ...inputStyle, fontSize: 11, marginBottom: 0 }}
                  />
                  <input
                    type="text"
                    value={officialTime}
                    onChange={e => {
                      const val = e.target.value;
                      setRrOfficialTimes(prev =>
                        Array.isArray(prev) ? prev.map((t, idx) => (idx === i ? val : t)) : []
                      );
                    }}
                    placeholder="Official time in match (MM:SS)"
                    style={{ ...inputStyle, fontSize: 11, marginBottom: 0 }}
                  />
                </div>
              </div>
            );
          })}
          
          {/* Eliminations Section */}
          {rrParticipants.filter(Boolean).length >= 2 && (
            <div style={{ marginTop: 16, padding: 16, background: '#2a2a2a', borderRadius: 8, border: '1px solid #444' }}>
              <div style={{ color: gold, fontWeight: 'bold', marginBottom: 12 }}>
                Eliminations
              </div>
              <div style={{ color: '#fff', fontSize: 12, marginBottom: 12 }}>
                Track each elimination in order. Include elimination time.
              </div>
              
              {rrEliminations.map((elimination, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, background: '#333', borderRadius: 4, marginBottom: 8, border: '1px solid #555' }}>
                  <span style={{ color: '#fff', minWidth: '80px', fontSize: 12 }}>Elimination #{index + 1}:</span>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block' }}>
                      Eliminated:
                    </label>
                    <select
                      value={elimination.eliminated || ''}
                      onChange={(e) => {
                        const newEliminations = [...rrEliminations];
                        newEliminations[index] = { ...newEliminations[index], eliminated: e.target.value };
                        setRrEliminations(newEliminations);
                      }}
                      style={inputStyle}
                    >
                      <option value="">Select wrestler...</option>
                      {rrParticipants.filter(Boolean).filter(p => {
                        const alreadyEliminated = rrEliminations
                          .filter((_, i) => i !== index)
                          .map(e => e.eliminated)
                          .includes(p);
                        return !alreadyEliminated && p !== rrWinner;
                      }).map(slug => (
                        <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block', flex: 1 }}>
                        Eliminated by:
                      </label>
                      {!elimination.eliminatedBy2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newEliminations = [...rrEliminations];
                            newEliminations[index] = { ...newEliminations[index], eliminatedBy2: '' };
                            setRrEliminations(newEliminations);
                          }}
                          style={{
                            background: gold,
                            color: '#232323',
                            border: 'none',
                            borderRadius: 4,
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 'bold',
                            height: 'fit-content'
                          }}
                          title="Add second eliminator"
                        >
                          +
                        </button>
                      )}
                    </div>
                    <select
                      value={elimination.eliminatedBy || ''}
                      onChange={(e) => {
                        const newEliminations = [...rrEliminations];
                        newEliminations[index] = { ...newEliminations[index], eliminatedBy: e.target.value };
                        setRrEliminations(newEliminations);
                      }}
                      style={inputStyle}
                    >
                      <option value="">Select wrestler...</option>
                      {rrParticipants.filter(Boolean).filter(p => p !== elimination.eliminated && p !== elimination.eliminatedBy2).map(slug => (
                        <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                      ))}
                    </select>
                    {elimination.eliminatedBy2 !== undefined && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block', flex: 1 }}>
                            Second eliminator:
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newEliminations = [...rrEliminations];
                              const updatedElim = { ...newEliminations[index] };
                              delete updatedElim.eliminatedBy2;
                              newEliminations[index] = updatedElim;
                              setRrEliminations(newEliminations);
                            }}
                            style={{
                              background: '#d32f2f',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: 14,
                              fontWeight: 'bold',
                              height: 'fit-content'
                            }}
                            title="Remove second eliminator"
                          >
                            ×
                          </button>
                        </div>
                        <select
                          value={elimination.eliminatedBy2 || ''}
                          onChange={(e) => {
                            const newEliminations = [...rrEliminations];
                            newEliminations[index] = { ...newEliminations[index], eliminatedBy2: e.target.value };
                            setRrEliminations(newEliminations);
                          }}
                          style={inputStyle}
                        >
                          <option value="">Select second wrestler...</option>
                          {rrParticipants.filter(Boolean).filter(p => p !== elimination.eliminated && p !== elimination.eliminatedBy).map(slug => (
                            <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 0.8 }}>
                    <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block' }}>
                      Elimination Time:
                    </label>
                    <input
                      type="text"
                      value={elimination.time || ''}
                      onChange={(e) => {
                        const newEliminations = [...rrEliminations];
                        newEliminations[index] = { ...newEliminations[index], time: e.target.value };
                        setRrEliminations(newEliminations);
                      }}
                      placeholder="e.g. 45:30"
                      style={inputStyle}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const newEliminations = rrEliminations.filter((_, i) => i !== index);
                      setRrEliminations(newEliminations);
                    }}
                    style={{
                      background: '#d32f2f',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      height: 'fit-content',
                      marginTop: 20
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              {rrEliminations.length < rrParticipants.filter(Boolean).length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setRrEliminations([...rrEliminations, { eliminated: '', eliminatedBy: '', time: '' }]);
                  }}
                  style={{
                    background: gold,
                    color: '#232323',
                    border: 'none',
                    borderRadius: 4,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginTop: 8
                  }}
                >
                  + Add Elimination
                </button>
              )}
            </div>
          )}

          {/* Winner Selection */}
          {effectiveStatus === 'completed' && rrParticipants.filter(Boolean).length > 0 && (
            <>
              <div style={{ marginTop: 16 }}>
                <label style={{ color: gold, fontWeight: 600 }}>Winner:</label>
                <select 
                  value={rrWinner} 
                  onChange={e => setRrWinner(e.target.value)} 
                  style={inputStyle}
                >
                  <option value="">Select winner</option>
                  {Array.isArray(rrParticipants) && rrParticipants.filter(Boolean).map((slug, i) => (
                    <option key={i} value={slug}>
                      {safeWrestlers.find(w => w.id === slug)?.name || slug}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ color: gold, fontWeight: 600 }}>
                  Manual Ironman / Ironwoman (optional):
                </label>
                <select
                  value={rrManualIronman || ''}
                  onChange={e => setRrManualIronman(e.target.value || '')}
                  style={inputStyle}
                >
                  <option value="">Let stats decide</option>
                  {Array.isArray(rrParticipants) && rrParticipants.filter(Boolean).map((slug, i) => (
                    <option key={i} value={slug}>
                      {safeWrestlers.find(w => w.id === slug)?.name || slug}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
                  Use this when first posting results. Later, official time-in-match data will override this choice automatically.
                </div>
              </div>
            </>
          )}
        </>
      ) : match.matchType === 'Elimination Chamber' ? (
        <>
          <div style={{ color: gold, fontWeight: 600, marginBottom: 8 }}>
            Elimination Chamber (6 Participants)
          </div>
          <div style={{ color: '#fff', fontSize: 12, marginBottom: 16 }}>
            Add the 6 participants so the match can be listed ahead of time. Result details (who started, pod order, winner) can be filled in when posting results.
          </div>
          
          {/* Participants (6) */}
          <div style={{ marginBottom: 16, padding: 12, background: '#2a2a2a', borderRadius: 8, border: '1px solid #444' }}>
            <div style={{ color: gold, fontWeight: 600, marginBottom: 8 }}>Participants (6)</div>
            {Array.isArray(ecParticipants) && ecParticipants.map((slug, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <WrestlerAutocomplete
                  wrestlers={safeWrestlers}
                  value={slug}
                  onChange={val => setEcParticipants(prev => Array.isArray(prev) ? prev.map((s, idx) => idx === i ? val : s) : [])}
                  placeholder={`Participant ${i + 1}`}
                />
              </div>
            ))}
          </div>
          
          {/* Result details (optional) */}
          {ecParticipants.filter(Boolean).length === 6 && (
            <div style={{ marginBottom: 16, padding: 12, background: '#1a2a1a', borderRadius: 8, border: '1px solid #355' }}>
              <div style={{ color: gold, fontWeight: 600, marginBottom: 4 }}>Result details (optional)</div>
              <div style={{ color: '#aaa', fontSize: 12, marginBottom: 12 }}>Fill in when posting results: starters, pod entry order and times, winner, eliminations.</div>
              <div style={{ color: '#fff', fontSize: 12, marginBottom: 8 }}>Starters (In Ring)</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <select value={ecStarter1} onChange={e => setEcStarter1(e.target.value)} style={inputStyle}>
                    <option value="">Starter 1</option>
                    {ecParticipants.filter(Boolean).map(slug => (
                      <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <select value={ecStarter2} onChange={e => setEcStarter2(e.target.value)} style={inputStyle}>
                    <option value="">Starter 2</option>
                    {ecParticipants.filter(Boolean).filter(p => p !== ecStarter1).map(slug => (
                      <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ color: '#fff', fontSize: 12, marginBottom: 8 }}>Pod entry order (remaining 4)</div>
              {[0, 1, 2, 3].map(idx => {
                const used = [ecStarter1, ecStarter2, ...(ecPodEntrants || []).slice(0, idx)].filter(Boolean);
                const available = ecParticipants.filter(Boolean).filter(p => !used.includes(p));
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ minWidth: 28, color: gold, fontSize: 12 }}>#{idx + 1}</span>
                    <select value={(ecPodEntrants || [])[idx] || ''} onChange={e => {
                      const prev = (ecPodEntrants || []).slice(0, 4);
                      while (prev.length < 4) prev.push('');
                      const next = prev.map((s, j) => j === idx ? e.target.value : s);
                      setEcPodEntrants(next);
                    }} style={{ ...inputStyle, flex: 1 }}>
                      <option value="">Pod entrant</option>
                      {available.map(slug => (
                        <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                      ))}
                    </select>
                    <input type="text" value={(ecPodEntryTimes || [])[idx] || ''} onChange={e => {
                      const prev = (ecPodEntryTimes || []).slice(0, 4);
                      while (prev.length < 4) prev.push('');
                      const t = [...prev];
                      t[idx] = e.target.value;
                      setEcPodEntryTimes(t);
                    }} placeholder="Time" style={{ ...inputStyle, width: 70 }} />
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Eliminations Section */}
          {ecParticipants.filter(Boolean).length === 6 && (
            <div style={{ marginTop: 16, padding: 16, background: '#2a2a2a', borderRadius: 8, border: '1px solid #444' }}>
              <div style={{ color: gold, fontWeight: 'bold', marginBottom: 12 }}>
                Eliminations
              </div>
              <div style={{ color: '#fff', fontSize: 12, marginBottom: 12 }}>
                Track each elimination in order. Include elimination time.
              </div>
              
              {ecEliminations.map((elimination, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, background: '#333', borderRadius: 4, marginBottom: 8, border: '1px solid #555' }}>
                  <span style={{ color: '#fff', minWidth: '80px', fontSize: 12 }}>Elimination #{index + 1}:</span>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block' }}>
                      Eliminated:
                    </label>
                    <select
                      value={elimination.eliminated || ''}
                      onChange={(e) => {
                        const newEliminations = [...ecEliminations];
                        newEliminations[index] = { ...newEliminations[index], eliminated: e.target.value };
                        setEcEliminations(newEliminations);
                      }}
                      style={inputStyle}
                    >
                      <option value="">Select wrestler...</option>
                      {ecParticipants.filter(Boolean).filter(p => {
                        const alreadyEliminated = ecEliminations
                          .filter((_, i) => i !== index)
                          .map(e => e.eliminated)
                          .includes(p);
                        return !alreadyEliminated && p !== ecWinner;
                      }).map(slug => (
                        <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {elimination.method === 'Referee decision' ? (
                      <div style={{ color: '#aaa', fontSize: 12, marginTop: 20 }}>No one (referee decision)</div>
                    ) : (
                    <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block', flex: 1 }}>
                        Eliminated by:
                      </label>
                      {!elimination.eliminatedBy2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newEliminations = [...ecEliminations];
                            newEliminations[index] = { ...newEliminations[index], eliminatedBy2: '' };
                            setEcEliminations(newEliminations);
                          }}
                          style={{
                            background: gold,
                            color: '#232323',
                            border: 'none',
                            borderRadius: 4,
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 'bold',
                            height: 'fit-content'
                          }}
                          title="Add second eliminator"
                        >
                          +
                        </button>
                      )}
                    </div>
                    <select
                      value={elimination.eliminatedBy || ''}
                      onChange={(e) => {
                        const newEliminations = [...ecEliminations];
                        newEliminations[index] = { ...newEliminations[index], eliminatedBy: e.target.value };
                        setEcEliminations(newEliminations);
                      }}
                      style={inputStyle}
                    >
                      <option value="">Select wrestler...</option>
                      {ecParticipants.filter(Boolean).filter(p => p !== elimination.eliminated && p !== elimination.eliminatedBy2).map(slug => (
                        <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                      ))}
                    </select>
                    {elimination.eliminatedBy2 !== undefined && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block', flex: 1 }}>
                            Second eliminator:
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newEliminations = [...ecEliminations];
                              const updatedElim = { ...newEliminations[index] };
                              delete updatedElim.eliminatedBy2;
                              newEliminations[index] = updatedElim;
                              setEcEliminations(newEliminations);
                            }}
                            style={{
                              background: '#d32f2f',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: 14,
                              fontWeight: 'bold',
                              height: 'fit-content'
                            }}
                            title="Remove second eliminator"
                          >
                            ×
                          </button>
                        </div>
                        <select
                          value={elimination.eliminatedBy2 || ''}
                          onChange={(e) => {
                            const newEliminations = [...ecEliminations];
                            newEliminations[index] = { ...newEliminations[index], eliminatedBy2: e.target.value };
                            setEcEliminations(newEliminations);
                          }}
                          style={inputStyle}
                        >
                          <option value="">Select second wrestler...</option>
                          {ecParticipants.filter(Boolean).filter(p => p !== elimination.eliminated && p !== elimination.eliminatedBy).map(slug => (
                            <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    </>
                    )}
                  </div>

                  <div style={{ flex: 0.6 }}>
                    <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block' }}>
                      How:
                    </label>
                    <select
                      value={elimination.method || ''}
                      onChange={(e) => {
                        const newEliminations = [...ecEliminations];
                        const method = e.target.value;
                        newEliminations[index] = { ...newEliminations[index], method };
                        if (method === 'Referee decision') newEliminations[index].eliminatedBy = '';
                        setEcEliminations(newEliminations);
                      }}
                      style={inputStyle}
                    >
                      <option value="">—</option>
                      <option value="Pinfall">Pinfall</option>
                      <option value="Submission">Submission</option>
                      <option value="Referee decision">Referee decision (injury/knockout)</option>
                    </select>
                  </div>

                  <div style={{ flex: 0.8 }}>
                    <label style={{ color: '#fff', fontSize: 11, marginBottom: 4, display: 'block' }}>
                      Elimination Time:
                    </label>
                    <input
                      type="text"
                      value={elimination.time || ''}
                      onChange={(e) => {
                        const newEliminations = [...ecEliminations];
                        newEliminations[index] = { ...newEliminations[index], time: e.target.value };
                        setEcEliminations(newEliminations);
                      }}
                      placeholder="e.g. 12:30"
                      style={inputStyle}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const newEliminations = ecEliminations.filter((_, i) => i !== index);
                      setEcEliminations(newEliminations);
                    }}
                    style={{
                      background: '#d32f2f',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      height: 'fit-content',
                      marginTop: 20
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              {ecEliminations.length < 5 && (
                <button
                  type="button"
                  onClick={() => {
                    setEcEliminations([...ecEliminations, { eliminated: '', eliminatedBy: '', time: '', method: '' }]);
                  }}
                  style={{
                    background: gold,
                    color: '#232323',
                    border: 'none',
                    borderRadius: 4,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginTop: 8
                  }}
                >
                  + Add Elimination
                </button>
              )}
            </div>
          )}

          {/* Winner Selection */}
          {ecParticipants.filter(Boolean).length === 6 && (
            <div style={{ marginTop: 16 }}>
              <label style={{ color: gold, fontWeight: 600 }}>Winner:</label>
              <select 
                value={ecWinner} 
                onChange={e => setEcWinner(e.target.value)} 
                style={inputStyle}
              >
                <option value="">Select winner</option>
                {ecParticipants.filter(Boolean).map((slug, i) => (
                  <option key={i} value={slug}>
                    {safeWrestlers.find(w => w.id === slug)?.name || slug}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 12 }}>
                <label style={{ color: gold, fontWeight: 600, marginBottom: 8, display: 'block' }}>
                  Iron Man / Iron Woman (optional):
                </label>
                <select
                  value={ecManualIronman || ''}
                  onChange={e => setEcManualIronman(e.target.value || '')}
                  style={inputStyle}
                >
                  <option value="">Let stats decide (longest in match)</option>
                  {[ecStarter1, ecStarter2, ...ecPodEntrants].filter(Boolean).map(slug => (
                    <option key={slug} value={slug}>{safeWrestlers.find(w => w.id === slug)?.name || slug}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </>
      ) : isSurvivorSeriesMatch ? (
        <div style={{ marginBottom: 16 }}>
          <SurvivorSeriesMatchBuilder
            wrestlers={safeWrestlers}
            value={match.participants}
            onChange={(value, matchType) => {
              const newMatch = { ...match, participants: value };
              if (matchType) newMatch.matchType = matchType;
              setMatch(newMatch);
            }}
            onResultChange={(ssResult) => {
              const winningTeamNames =
                ssResult.winningTeam === 1
                  ? ssResult.team1Names.join(' & ')
                  : ssResult.team2Names.join(' & ');
              const losingTeamNames =
                ssResult.winningTeam === 1
                  ? ssResult.team2Names.join(' & ')
                  : ssResult.team1Names.join(' & ');
              const survivorLabel = ssResult.survivorName || ssResult.survivor;
              const resultText = `${winningTeamNames} def. ${losingTeamNames} (Survivor: ${survivorLabel}${ssResult.time ? `, ${ssResult.time}` : ''})`;
              setMatch((prev) => ({
                ...prev,
                survivorSeriesData: ssResult,
                winner: survivorLabel,
                method: 'Pinfall',
                time: ssResult.time || prev.time,
                result: resultText,
              }));
            }}
          />
        </div>
      ) : isWarGamesMatch ? (
        <div style={{ marginBottom: 16 }}>
          <WarGamesMatchBuilder
            wrestlers={safeWrestlers}
            value={match.participants}
            onChange={(value, matchType) => {
              const newMatch = { ...match, participants: value };
              if (matchType) newMatch.matchType = matchType;
              setMatch(newMatch);
            }}
            onResultChange={(warGamesResult) => {
              const winningTeamNames =
                warGamesResult.winningTeam === 1
                  ? warGamesResult.team1Names.join(' & ')
                  : warGamesResult.team2Names.join(' & ');
              const losingTeamNames =
                warGamesResult.winningTeam === 1
                  ? warGamesResult.team2Names.join(' & ')
                  : warGamesResult.team1Names.join(' & ');
              const pinWinnerName =
                warGamesResult.pinWinnerName || warGamesResult.pinSubmissionWinner;
              let entryOrderText = '';
              if (
                warGamesResult.entryOrder &&
                Array.isArray(warGamesResult.entryOrder) &&
                warGamesResult.entryOrder.length > 0
              ) {
                const sortedEntries = [...warGamesResult.entryOrder].sort(
                  (a, b) => a.entryNumber - b.entryNumber
                );
                const entryNames = sortedEntries.map((entry) => {
                  const wrestler = safeWrestlers.find((w) => w.id === entry.wrestler);
                  return wrestler ? wrestler.name : entry.wrestler;
                });
                entryOrderText = ` [Entry Order: ${entryNames.join(' → ')}]`;
              }
              const resultText = `${winningTeamNames} def. ${losingTeamNames} (${warGamesResult.method} by ${pinWinnerName}${entryOrderText}${warGamesResult.time ? `, ${warGamesResult.time}` : ''})`;
              setMatch((prev) => ({
                ...prev,
                warGamesData: warGamesResult,
                winner: winningTeamNames,
                method: warGamesResult.method,
                time: warGamesResult.time,
                result: resultText,
              }));
            }}
          />
        </div>
      ) : (
        <>
          {/* Check if this is a title match - if so, always use visual builder */}
          {(() => {
            const isTitleMatch = match.title && match.title !== 'None' && match.stipulation !== 'No. 1 Contender Match';
            const shouldUseVisualBuilder = isTitleMatch ? true : useVisualBuilder;
            
            return (
              <>
                {/* Participant Input Toggle - hide for title matches since visual builder is required */}
                {!isTitleMatch && !isSurvivorSeriesMatch && !isWarGamesMatch && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ color: gold, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={useVisualBuilder}
                        onChange={e => setUseVisualBuilder(e.target.checked)}
                        style={{ marginRight: 8 }}
                      />
                      Use Visual Match Builder
                    </label>
                  </div>
                )}
                
                {isTitleMatch && (
                  <div style={{ marginBottom: 16, padding: 8, background: '#2a2a2a', borderRadius: 4, border: '1px solid #C6A04F' }}>
                    <div style={{ color: '#C6A04F', fontWeight: 600, fontSize: 14 }}>
                      💡 Title Match: Use the "C" button next to participants to mark the defending champion
                    </div>
                  </div>
                )}

                {shouldUseVisualBuilder ? (
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: gold, fontWeight: 600, marginBottom: 8, display: 'block' }}>
                Participants (Visual Builder):
              </label>
                {match.matchType === 'Gauntlet Match' ? (
                <GauntletMatchBuilder
                  wrestlers={safeWrestlers}
                  value={match.participants}
                  initialProgression={initialMatch.gauntletProgression}
                  onChange={(value, matchType) => {
                    console.log('GauntletMatchBuilder onChange called with value:', value, 'matchType:', matchType);
                    const newMatch = { ...match, participants: value };
                    if (matchType) {
                      newMatch.matchType = matchType;
                    }
                    setMatch(newMatch);
                  }}
                  onResultChange={gauntletResult => {
                    console.log('Gauntlet result:', gauntletResult);
                    const winnerName = safeWrestlers.find(w => w.id === gauntletResult.winner)?.name || gauntletResult.winner;
                    setMatch(prev => ({
                      ...prev,
                      gauntletProgression: gauntletResult.progression,
                      winner: gauntletResult.winner,
                      result: `${winnerName}`
                    }));
                  }}
                />
              ) : match.matchType === 'Tag Team Gauntlet Match' ? (
                <TagTeamGauntletMatchBuilder
                  wrestlers={safeWrestlers}
                  value={match.participants}
                  initialProgression={initialMatch.gauntletProgression}
                  onChange={(value, matchType) => {
                    const newMatch = { ...match, participants: value };
                    if (matchType) newMatch.matchType = matchType;
                    setMatch(newMatch);
                  }}
                  onResultChange={gauntletResult => {
                    setMatch(prev => ({
                      ...prev,
                      gauntletProgression: gauntletResult.progression,
                      winner: gauntletResult.winner,
                      result: gauntletResult.winner || prev.result
                    }));
                  }}
                />
              ) : match.matchType === '2 out of 3 Falls' ? (
                <TwoOutOfThreeFallsBuilder
                  wrestlers={safeWrestlers}
                  value={match.participants}
                  onChange={(value, matchType) => {
                    console.log('TwoOutOfThreeFallsBuilder onChange called with value:', value, 'matchType:', matchType);
                    const newMatch = { ...match, participants: value };
                    if (matchType) {
                      newMatch.matchType = matchType;
                    }
                    setMatch(newMatch);
                  }}
                  onResultChange={fallsResult => {
                    console.log('2 out of 3 Falls result:', fallsResult);
                    // Store the falls progression data
                    setMatch(prev => ({
                      ...prev,
                      gauntletProgression: fallsResult.gauntletProgression,
                      winner: fallsResult.winner,
                      method: fallsResult.method,
                      time: fallsResult.time
                    }));
                  }}
                />
              ) : (
                <VisualMatchBuilder
                  wrestlers={safeWrestlers}
                  initialTagTeamData={initialTagTeamData ?? null}
                  matchType={match.matchType}
                  value={match.participants}
                  onChange={(value, matchType) => {
                    console.log('VisualMatchBuilder onChange called with value:', value, 'matchType:', matchType);
                    console.log('Current match state:', match);
                    const newMatch = { ...match, participants: value };
                    if (matchType) {
                      newMatch.matchType = matchType;
                    }
                    console.log('New match state will be:', newMatch);
                    setMatch(newMatch);
                  }}
                  maxParticipants={30}
                  initialStructure={parseExistingMatchStructure(match) || getMatchStructureFromMatchType(match.matchType)}
                  isTitleMatch={match.title && match.title !== 'None' && match.stipulation !== 'No. 1 Contender Match'}
                  defendingChampion={match.defendingChampion || null}
                  onDefendingChampionChange={(champion) => {
                    setMatch({ ...match, defendingChampion: champion || '' });
                  }}
                />
              )}
            </div>
          ) : (
            <div>
              <label>
                Participants:<br />
                <input
                  value={match.participants}
                  onChange={e => setMatch({ ...match, participants: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
              </label>
            </div>
          )}
              </>
            );
          })()}
        </>
      )}
      {effectiveStatus === 'completed' &&
        !isBattleRoyal &&
        !isRoyalRumble &&
        !isEliminationChamber &&
        !isSurvivorSeriesMatch &&
        !isWarGamesMatch &&
        match.matchType !== 'Gauntlet Match' &&
        match.matchType !== 'Tag Team Gauntlet Match' &&
        match.matchType !== '2 out of 3 Falls' && (
        <>
          <div>
            <label>
              Result Type:<br />
              <select value={resultType} onChange={e => {
                setResultType(e.target.value);
                setWinner('');
              }} style={{ width: '100%' }} required>
                <option value="">Select result type...</option>
                <option value="Winner">Winner</option>
                <option value="No Winner">No Winner</option>
              </select>
            </label>
          </div>
          {resultType === 'Winner' && winnerOptions.length >= 2 && match.matchType !== 'Gauntlet Match' && match.matchType !== 'Tag Team Gauntlet Match' && match.matchType !== '2 out of 3 Falls' && (
            <div>
              <label>
                Winner:<br />
                <select
                  value={winner}
                  onChange={e => setWinner(e.target.value)}
                  style={{ width: '100%' }}
                  required
                >
                  <option value="">Select winner</option>
                  {Array.isArray(winnerOptions) && winnerOptions.map(side => (
                    <option key={side} value={side}>{side}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div>
            <label>
              Method:<br />
              <select value={match.method} onChange={e => setMatch({ ...match, method: e.target.value })} required style={{ width: '100%' }}>
                <option value="">Select method</option>
                {METHOD_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label>
              Time:<br />
              <input value={match.time} onChange={e => setMatch({ ...match, time: e.target.value })} style={{ width: '100%' }} />
            </label>
          </div>
          <div>
            <label>
              Notes (optional):<br />
              <textarea 
                value={match.notes || ''} 
                onChange={e => setMatch({ ...match, notes: e.target.value })} 
                style={{ width: '100%', minHeight: '60px', padding: '8px', backgroundColor: '#232323', color: 'white', border: '1px solid #888' }}
                placeholder="Enter any additional notes about the match..."
              />
            </label>
          </div>
        </>
      )}
      {effectiveStatus === 'completed' && (
        <div>
          <label>
            Match Summary (optional):<br />
            <textarea
              value={match.summary || ''}
              onChange={e => setMatch({ ...match, summary: e.target.value })}
              style={{ width: '100%', minHeight: '72px', padding: '8px', backgroundColor: '#232323', color: 'white', border: '1px solid #888' }}
              placeholder="Brief recap of the match for the Summary view on the match card..."
            />
          </label>
        </div>
      )}
      {/* Title outcome should appear above special match winner in the form */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>
          Title Outcome:
        </label>
        <select
          value={match.titleOutcome || ""}
          onChange={e => setMatch({ ...match, titleOutcome: e.target.value })}
          style={inputStyle}
        >
          {TITLE_OUTCOME_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {match.title && match.title !== 'None' && (
          <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>
            <strong>Guidance:</strong> Use "Champion Retains" when the champion keeps the title (wins OR loses by DQ/Count Out). 
            Use "New Champion" only when the title actually changes hands.
          </div>
        )}
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>
          Special Match Winner:
        </label>
        <select
          value={match.specialWinnerType || "None"}
          onChange={e => setMatch({ ...match, specialWinnerType: e.target.value })}
          style={inputStyle}
        >
          {specialWinnerOptionsResolved.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      {match.title && match.title !== 'None' && match.stipulation !== 'No. 1 Contender Match' && !useVisualBuilder && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            Defending Champion:
          </label>
          <select
            value={match.defendingChampion || ""}
            onChange={e => setMatch({ ...match, defendingChampion: e.target.value })}
            style={inputStyle}
          >
            <option value="">Select defending champion...</option>
            {(() => {
              // Extract participant options from match.participants
              const participantOptions = [];
              if (typeof match.participants === 'string' && match.participants.includes(' vs ')) {
                const sides = match.participants.split(' vs ').map(s => s.trim());
                sides.forEach(side => {
                  const teamMatch = side.match(/^([^(]+)\s*\(([^)]+)\)$/);
                  if (teamMatch) {
                    // Tag team with name - use team name
                    participantOptions.push(teamMatch[1].trim());
                  } else {
                    // Individual or team without name - use the side as-is
                    participantOptions.push(side);
                  }
                });
              } else if (Array.isArray(match.participants)) {
                // Array format - use each element
                match.participants.forEach(participant => {
                  if (typeof participant === 'string') {
                    const teamMatch = participant.match(/^([^(]+)\s*\(([^)]+)\)$/);
                    if (teamMatch) {
                      participantOptions.push(teamMatch[1].trim());
                    } else {
                      participantOptions.push(participant);
                    }
                  }
                });
              }
              return participantOptions.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ));
            })()}
          </select>
          <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>
            Select who entered the match as the defending champion. This helps determine who shows the belt when "Champion Retains" is selected.
          </div>
        </div>
      )}
      {match.title && match.title !== 'None' && match.stipulation !== 'No. 1 Contender Match' && useVisualBuilder && (
        <div style={{ fontSize: 12, color: '#C6A04F', marginTop: 4, marginBottom: 16, fontStyle: 'italic' }}>
          💡 <strong>Tip:</strong> Click the "C" button next to a participant in the visual builder to mark them as the defending champion.
        </div>
      )}
      {/* Begin Match Button - explicitly starts live commentary mode */}
      {status !== 'completed' && (!Array.isArray(commentary) || commentary.length === 0) && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button 
            type="button" 
            onClick={handleBeginMatch}
            style={{ 
              background: '#27ae60', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🟢 Begin Match
          </button>
        </div>
      )}

      {/* Commentary UI: only show once commentary has actually started */}
      {Array.isArray(commentary) && commentary.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ color: '#C6A04F', marginBottom: 12 }}>Live Commentary</h3>
          {status === 'live' && !liveEnd && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={commentaryInput}
                onChange={e => setCommentaryInput(e.target.value)}
                placeholder="Enter live commentary..."
                style={{ flex: 1, ...inputStyle, marginBottom: 0 }}
                onKeyPress={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCommentary(e);
                  }
                }}
              />
              <button 
                type="button" 
                onClick={handleAddCommentary}
                disabled={isAddingCommentary}
                style={{ 
                  background: isAddingCommentary ? '#666' : '#C6A04F', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 4, 
                  padding: '8px 16px',
                  cursor: isAddingCommentary ? 'not-allowed' : 'pointer'
                }}
              >
                {isAddingCommentary ? 'Adding...' : 'Submit'}
              </button>
            </div>
          )}
          <div style={{ maxHeight: 200, overflowY: 'auto', background: '#181818', borderRadius: 4, padding: 8 }}>
            {(!Array.isArray(commentary) || commentary.length === 0) && <div style={{ color: '#bbb' }}>No commentary yet.</div>}
            {Array.isArray(commentary) && commentary.map((c, idx) => (
              <div key={idx} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#C6A04F', minWidth: 32 }}>{formatCommentaryTime(c.timestamp, liveStart, commentary)}</span>
                {editingCommentIdx === idx ? (
                  <>
                    <input
                      value={editingCommentText}
                      onChange={e => setEditingCommentText(e.target.value)}
                      style={{ flex: 1, ...inputStyle, marginBottom: 0 }}
                      autoFocus
                    />
                    <button type="button" onClick={() => {
                      // Save edit
                      const updated = commentary.map((item, i) => i === idx ? { ...item, text: editingCommentText } : item);
                      setCommentary(updated);
                      setEditingCommentIdx(null);
                      setEditingCommentText("");
                      
                      // Update in real-time
                      if (onRealTimeCommentaryUpdate && eventId && matchOrder) {
                        const updatedMatch = {
                          ...match,
                          commentary: updated
                        };
                        onRealTimeCommentaryUpdate(eventId, matchOrder, updatedMatch);
                      }
                    }}>Save</button>
                    <button type="button" onClick={() => {
                      setEditingCommentIdx(null);
                      setEditingCommentText("");
                    }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#fff', flex: 1 }}>{c.text}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommentIdx(idx);
                        setEditingCommentText(c.text);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Delete this commentary entry
                        const updated = commentary.filter((_, i) => i !== idx);
                        setCommentary(updated);

                        // If no commentary remains, also clear liveStart/liveEnd
                        // so the match can fully exit commentary mode.
                        if (updated.length === 0) {
                          setLiveStart(null);
                          setLiveEnd(null);
                        }

                        // Update in real-time if hook is provided
                        if (onRealTimeCommentaryUpdate && eventId && matchOrder) {
                          const updatedMatch = {
                            ...match,
                            commentary: updated,
                            liveStart: updated.length > 0 ? (liveStart || updated[updated.length - 1].timestamp) : null,
                            liveEnd: updated.length === 0 ? null : liveEnd,
                          };
                          onRealTimeCommentaryUpdate(eventId, matchOrder, updatedMatch);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
            {liveEnd && (
              <div style={{ color: '#bbb', marginTop: 8 }}>
                Match duration: {getElapsedMinutes(liveEnd)} minute{getElapsedMinutes(liveEnd) !== 1 ? 's' : ''}
              </div>
            )}
            {Array.isArray(commentary) && commentary.length > 0 && (
              <div style={{ marginTop: 8, textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => {
                    setCommentary([]);
                    setLiveStart(null);
                    setLiveEnd(null);

                    if (onRealTimeCommentaryUpdate && eventId && matchOrder) {
                      const updatedMatch = {
                        ...match,
                        commentary: [],
                        liveStart: null,
                        liveEnd: null,
                      };
                      onRealTimeCommentaryUpdate(eventId, matchOrder, updatedMatch);
                    }
                  }}
                  style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: '1px solid #666',
                    background: '#333',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Clear all commentary
                </button>
              </div>
            )}
          </div>
          {status === 'live' && !liveEnd && (
            <button type="button" onClick={handleEndMatch} style={{ marginTop: 16, background: '#e63946', color: 'white', padding: '10px 24px', border: 'none', borderRadius: 4, fontWeight: 700 }}>
              End Match
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: 10 }}>Cancel</button>
        <button 
          type="button" 
          onClick={(e) => {
            console.error('🔵 SAVE BUTTON CLICKED');
            e.preventDefault();
            handleSave(e);
          }}
          style={{ flex: 1, background: '#e63946', color: '#fff', border: 'none', borderRadius: 4, padding: 10 }}
        >
          {isAdd ? 'Add Match' : 'Save Match'}
        </button>
      </div>
    </div>
  );
} 